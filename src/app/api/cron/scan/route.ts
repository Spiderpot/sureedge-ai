export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { smartScan } from '@/lib/odds-engine';

// ONLY bookmakers you have funded accounts on — no point showing others
const MY_BOOKMAKERS = new Set([
  'pinnacle',     // Funded $10
  '1xbet',        // Funded
  'onexbet',      // Same as 1xbet
  '22bet',        // Funded
  // Add more as you create accounts:
  // 'bet9ja',
  // 'sportybet',
]);

const BM_INFO: Record<string, { name: string; deposit: string; url: string }> = {
  'pinnacle':  { name: 'Pinnacle',  deposit: 'Crypto (USDT)',    url: 'https://pinnacle.com' },
  '1xbet':     { name: '1xBet',     deposit: 'Naira, bank',      url: 'https://1xbet.ng' },
  'onexbet':   { name: '1xBet',     deposit: 'Naira, bank',      url: 'https://1xbet.ng' },
  '22bet':     { name: '22Bet',     deposit: 'Naira, crypto',    url: 'https://22bet.ng' },
  'bet9ja':    { name: 'Bet9ja',    deposit: 'Naira, bank',      url: 'https://bet9ja.com' },
  'sportybet': { name: 'SportyBet', deposit: 'Naira, bank',      url: 'https://sportybet.com' },
};

const SPORT_ROTATION = ['basketball_nba', 'soccer_epl', 'baseball_mlb'];

// Minimum arb % worth alerting — below this, profit is too small to act on
const MIN_ARB_PCT = 1.0;

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

  // Filter to ONLY bookmakers you have accounts on
  const myBooks = event.bookmakers.filter(bm => MY_BOOKMAKERS.has(bm.key.toLowerCase()));
  if (myBooks.length < 2) return [];

  // Find best odds across YOUR bookmakers only
  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  for (const bm of myBooks) {
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

  // Only return arbs above minimum threshold
  if (arbFraction >= 1.05) return [];
  if (arbPct < MIN_ARB_PCT && arbFraction >= 1.0) return []; // Near-arbs below 1% = skip

  const hasPinnacle = outcomes.some(([, o]) => o.key.toLowerCase() === 'pinnacle');

  return [{
    match:         `${event.homeTeam} vs ${event.awayTeam}`,
    sport:         event.sportTitle,
    arbPercentage: arbPct,
    isGenuineArb:  arbFraction < 1.0,
    hasPinnacle,
    hasSharpSoft:  hasPinnacle && outcomes.some(([, o]) => o.key.toLowerCase() !== 'pinnacle'),
    riskLevel:     (arbFraction < 1.0 ? 'LOW' : 'MEDIUM') as string,
    outcomes: outcomes.map(([name, o]) => {
      const info = BM_INFO[o.key.toLowerCase()];
      return {
        outcome:       name,
        odds:          o.odds,
        bookmaker:     info?.name || o.title,
        impliedProb:   parseFloat(((1 / o.odds) * 100).toFixed(2)),
        depositMethod: info?.deposit || '',
        bookmakerUrl:  info?.url || '',
        tier:          o.key.toLowerCase() === 'pinnacle' ? 1 : 2,
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
  log.push(`Scanning: ${sportKey}`);

  let quotaUsed = 0;
  let quotaRemaining = 0;
  const allArbs: ReturnType<typeof detectArbitrage> = [];

  try {
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

  allArbs.sort((a, b) => b.arbPercentage - a.arbPercentage);

  const genuineArbs = allArbs.filter(a => a.isGenuineArb);
  let telegramSent = 0;

  // ONLY alert for genuine arbs above 1% — nothing else
  for (const arb of genuineArbs) {
    if (arb.arbPercentage >= MIN_ARB_PCT) {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    }
  }

  log.push(`Found: ${genuineArbs.length} arbs (${genuineArbs.filter(a => a.arbPercentage >= MIN_ARB_PCT).length} above ${MIN_ARB_PCT}%), Telegram: ${telegramSent}`);

  return success({
    scannedAt:     new Date().toISOString(),
    sport:         sportKey,
    genuineArbs:   genuineArbs.length,
    profitableArbs: genuineArbs.filter(a => a.arbPercentage >= MIN_ARB_PCT).length,
    telegramSent,
    quotaUsed,
    quotaRemaining,
    log,
  });
}
