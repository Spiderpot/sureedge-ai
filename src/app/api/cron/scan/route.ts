export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { smartScan } from '@/lib/odds-engine';

const NG_BOOKMAKERS: Record<string, { name: string; tier: number; deposit: string; url: string }> = {
  'pinnacle':    { name: 'Pinnacle',    tier: 1, deposit: 'Crypto (USDT TRC-20)', url: 'https://pinnacle.com' },
  '1xbet':       { name: '1xBet',       tier: 2, deposit: 'Naira, bank, USSD',   url: 'https://1xbet.ng' },
  'onexbet':     { name: '1xBet',       tier: 2, deposit: 'Naira, bank, USSD',   url: 'https://1xbet.ng' },
  '22bet':       { name: '22Bet',       tier: 2, deposit: 'Naira, bank, crypto',  url: 'https://22bet.ng' },
  'betway':      { name: 'Betway',      tier: 2, deposit: 'Naira, bank, card',    url: 'https://betway.com.ng' },
  'marathonbet': { name: 'MarathonBet', tier: 3, deposit: 'Crypto, e-wallets',    url: 'https://marathonbet.com' },
  'betonlineag': { name: 'BetOnline',   tier: 3, deposit: 'Crypto (BTC/USDT)',    url: 'https://betonline.ag' },
  'bovada':      { name: 'Bovada',      tier: 3, deposit: 'Crypto (BTC/USDT)',    url: 'https://bovada.lv' },
  'mybookieag':  { name: 'MyBookie',    tier: 3, deposit: 'Crypto',               url: 'https://mybookie.ag' },
  'betus':       { name: 'BetUS',       tier: 3, deposit: 'Crypto',               url: 'https://betus.com.pa' },
  'sport888':    { name: '888sport',    tier: 3, deposit: 'E-wallets',            url: 'https://888sport.com' },
};

function isNG(key: string) { return key.toLowerCase() in NG_BOOKMAKERS; }
function getNG(key: string) { return NG_BOOKMAKERS[key.toLowerCase()] || null; }

const SPORT_ROTATION = ['basketball_nba', 'soccer_epl', 'baseball_mlb'];

interface NormalizedEvent {
  eventId: string;
  sportTitle: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: { key: string; title: string; outcomes: { name: string; price: number }[] }[];
}

function detectArbitrage(event: NormalizedEvent) {
  if (event.bookmakers.length < 2) return [];

  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  for (const bm of event.bookmakers) {
    for (const o of bm.outcomes) {
      if (o.price <= 1.01) continue;
      if (!bestOdds[o.name] || o.price > bestOdds[o.name].odds) {
        bestOdds[o.name] = { odds: o.price, key: bm.key, title: bm.title };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction >= 1.05) return [];
  if (!outcomes.every(([, o]) => isNG(o.key))) return [];

  const hasPinnacle = outcomes.some(([, o]) => o.key.toLowerCase() === 'pinnacle');

  return [{
    match:         `${event.homeTeam} vs ${event.awayTeam}`,
    sport:         event.sportTitle,
    arbPercentage: arbPct,
    isGenuineArb:  arbFraction < 1.0,
    hasPinnacle,
    hasSharpSoft:  hasPinnacle && outcomes.some(([, o]) => (getNG(o.key)?.tier || 99) >= 2),
    riskLevel:     (arbFraction < 1.0 ? 'LOW' : 'MEDIUM') as string,
    outcomes: outcomes.map(([name, o]) => {
      const ng = getNG(o.key);
      return {
        outcome:       name,
        odds:          o.odds,
        bookmaker:     ng?.name || o.title,
        impliedProb:   parseFloat(((1 / o.odds) * 100).toFixed(2)),
        depositMethod: ng?.deposit || '',
        bookmakerUrl:  ng?.url || '',
        tier:          ng?.tier || 99,
      };
    }),
  }];
}

export async function GET(request: NextRequest) {
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET;
  const querySecret = new URL(request.url).searchParams.get('secret');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isAuthed = cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!isVercelCron && !isAuthed && cronSecret) {
    return error('Unauthorized', 401);
  }

  // Rotate sport
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const rotationIndex = Math.floor(minuteOfDay / 15) % SPORT_ROTATION.length;
  const sportKey = SPORT_ROTATION[rotationIndex];

  const log: string[] = [];
  log.push(`Scanning: ${sportKey} (rotation ${rotationIndex + 1}/${SPORT_ROTATION.length})`);

  let quotaUsed = 0;
  let quotaRemaining = 0;
  const allArbs: ReturnType<typeof detectArbitrage> = [];

  try {
    // Use smartScan — tries OddsPapi first, falls back to The Odds API
    const result = await smartScan(sportKey);
    quotaUsed = result.quotaUsed;
    quotaRemaining = result.quotaRemaining;
    log.push(...result.debug);

    for (const event of result.events) {
      allArbs.push(...detectArbitrage(event));
    }
  } catch (e) {
    log.push(`Error: ${String(e)}`);
  }

  // Sort by arb percentage
  allArbs.sort((a, b) => b.arbPercentage - a.arbPercentage);

  const genuineArbs = allArbs.filter(a => a.isGenuineArb);
  const nearArbs    = allArbs.filter(a => !a.isGenuineArb);
  let telegramSent  = 0;

  // ALWAYS send alerts for genuine arbs
  for (const arb of genuineArbs) {
    if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
  }

  // ALWAYS send top 3 near-arbs (these are actionable opportunities)
  if (nearArbs.length > 0) {
    const top3 = nearArbs.slice(0, 3);
    let msg = `\u{1F50D} <b>SureEdge Scan: ${sportKey.replace('_', ' ').toUpperCase()}</b>\n\n`;
    msg += `Found <b>${nearArbs.length}</b> near-arb opportunities\n\n`;
    
    for (const arb of top3) {
      const icon = arb.hasPinnacle ? '\u{1F4A0}' : '\u{26BE}';
      msg += `${icon} <b>${arb.match}</b>\n`;
      msg += `   Margin: <b>${arb.arbPercentage.toFixed(2)}%</b>`;
      if (arb.hasPinnacle) msg += ' (Pinnacle)';
      msg += '\n';
      for (const o of arb.outcomes) {
        msg += `   ${o.bookmaker}: ${o.outcome} @ ${o.odds}\n`;
      }
      msg += '\n';
    }

    if (nearArbs.length > 3) {
      msg += `+${nearArbs.length - 3} more in app\n\n`;
    }

    msg += `\u{1F517} <a href="https://sureedge-ai.vercel.app">Open SureEdge AI</a>`;
    
    if (await sendTelegramAlert(msg)) telegramSent++;
  }

  // No opportunities at all — notify once per hour only
  if (allArbs.length === 0 && new Date().getMinutes() < 15) {
    await sendTelegramAlert(
      `\u{1F50D} <b>Auto-scan: ${sportKey.replace('_', ' ')}</b>\n\nNo opportunities right now.\nNext scan in 15 min.`
    );
    telegramSent++;
  }

  log.push(`Genuine: ${genuineArbs.length}, Near-arbs: ${nearArbs.length}, Telegram: ${telegramSent}`);

  return success({
    scannedAt:     new Date().toISOString(),
    sport:         sportKey,
    genuineArbs:   genuineArbs.length,
    nearArbs:      nearArbs.length,
    telegramSent,
    quotaUsed,
    quotaRemaining,
    log,
  });
}
