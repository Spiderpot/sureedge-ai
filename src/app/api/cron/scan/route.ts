export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Rotate through sports each scan — 1 sport per scan = 4 credits
// Rotates: NBA → EPL → MLB → NBA → EPL → MLB ...
const SPORT_ROTATION = [
  'basketball_nba',
  'soccer_epl',
  'baseball_mlb',
];

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

interface Outcome { name: string; price: number }
interface Market { key: string; outcomes: Outcome[] }
interface Bookmaker { key: string; title: string; markets: Market[] }
interface Event {
  id: string; sport_key: string; sport_title: string;
  commence_time: string; home_team: string; away_team: string;
  bookmakers: Bookmaker[];
}

function detectArbitrage(event: Event) {
  if (event.bookmakers.length < 2) return [];

  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  for (const bm of event.bookmakers) {
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const o of market.outcomes) {
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
    match:         `${event.home_team} vs ${event.away_team}`,
    sport:         event.sport_title,
    arbPercentage: arbPct,
    isGenuineArb:  arbFraction < 1.0,
    hasPinnacle,
    hasSharpSoft:  hasPinnacle && outcomes.some(([, o]) => (getNG(o.key)?.tier || 99) >= 2),
    riskLevel:     arbFraction < 1.0 ? 'LOW' : 'MEDIUM',
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

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return error('ODDS_API_KEY not configured', 500);

  // Rotate sport based on current time — scans a different sport each run
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const rotationIndex = Math.floor(minuteOfDay / 15) % SPORT_ROTATION.length;
  const sportKey = SPORT_ROTATION[rotationIndex];

  const log: string[] = [];
  log.push(`Scanning: ${sportKey} (rotation ${rotationIndex + 1}/${SPORT_ROTATION.length})`);

  let quotaUsed = 0;
  let quotaRemaining = 0;
  const allArbs: ReturnType<typeof detectArbitrage> = [];

  try {
    // Use eu,uk regions — this is where Pinnacle + 1xBet live
    // Costs 2 credits per scan (not 4)
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'eu,uk',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, { cache: 'no-store' });
    quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
    quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

    log.push(`Credits: ${quotaUsed} used, ${quotaRemaining} remaining`);

    // Stop scanning if credits are critically low
    if (quotaRemaining < 20) {
      log.push('WARNING: Credits critically low — pausing auto-scan');
      await sendTelegramAlert(
        '\u26A0\uFE0F <b>SureEdge Warning</b>\n\n' +
        `Only <b>${quotaRemaining}</b> Odds API credits remaining.\n` +
        'Auto-scanner pausing to preserve credits.\n' +
        'Credits reset on the 1st of each month.\n\n' +
        'Manual scanning still works in the app.'
      );
      return success({ scannedAt: new Date().toISOString(), paused: true, quotaRemaining, log });
    }

    if (!res.ok) {
      if (res.status === 401) { log.push('ERROR: Invalid API key'); return success({ log, quotaRemaining }); }
      if (res.status === 422) { log.push(`${sportKey}: no events currently`); }
      if (res.status === 429) { log.push('ERROR: Quota exceeded'); return success({ log, quotaRemaining: 0 }); }
    } else {
      const events: Event[] = await res.json();
      log.push(`${sportKey}: ${events.length} events, ${events.reduce((s, e) => s + e.bookmakers.length, 0)} bookmakers`);

      for (const event of events) {
        allArbs.push(...detectArbitrage(event));
      }
    }
  } catch (e) {
    log.push(`Error: ${String(e)}`);
  }

  // Telegram alerts
  const genuineArbs = allArbs.filter(a => a.isGenuineArb);
  const nearArbs    = allArbs.filter(a => !a.isGenuineArb);
  let telegramSent  = 0;

  for (const arb of genuineArbs) {
    if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
  }

  // Near-arb summary only at top of hour (not every 15 min — reduces noise)
  if (nearArbs.length > 0 && genuineArbs.length === 0 && new Date().getMinutes() < 15) {
    const best = nearArbs.sort((a, b) => b.arbPercentage - a.arbPercentage)[0];
    const summary = `\u{1F50D} <b>Auto-Scan: ${sportKey}</b>\n\n` +
      `${nearArbs.length} near-arb(s) found\n` +
      `Best: <b>${best.match}</b> (${best.arbPercentage.toFixed(2)}%)\n` +
      (best.hasPinnacle ? '\u{1F4A0} Pinnacle involved\n' : '') +
      `\nCredits left: ${quotaRemaining}\n` +
      `\u{1F517} <a href="https://sureedge-ai.vercel.app">Open SureEdge</a>`;
    if (await sendTelegramAlert(summary)) telegramSent++;
  }

  log.push(`Genuine arbs: ${genuineArbs.length}, Near-arbs: ${nearArbs.length}, Telegram sent: ${telegramSent}`);

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
