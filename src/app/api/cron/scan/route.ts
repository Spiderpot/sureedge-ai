export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { smartScan, NormalizedOdds } from '@/lib/odds-engine';

// Same bookmaker config as main scanner
const NG_BOOKMAKERS: Record<string, { tier: number }> = {
  'pinnacle': { tier: 1 }, '1xbet': { tier: 2 }, 'onexbet': { tier: 2 },
  '22bet': { tier: 2 }, 'betway': { tier: 2 }, 'marathonbet': { tier: 3 },
  'betonlineag': { tier: 3 }, 'bovada': { tier: 3 }, 'mybookieag': { tier: 3 },
  'betus': { tier: 3 }, 'sport888': { tier: 3 },
};

function isNG(key: string) { return key.toLowerCase() in NG_BOOKMAKERS; }
function getTier(key: string) { return NG_BOOKMAKERS[key.toLowerCase()]?.tier || 99; }

// Sports to auto-scan — ranked by arb frequency
const AUTO_SCAN_SPORTS = [
  'basketball_nba',
  'soccer_epl',
  'baseball_mlb',
];

function detectArbitrage(event: NormalizedOdds) {
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
  const hasSharpSoft = outcomes.some(([, o]) => getTier(o.key) === 1) && outcomes.some(([, o]) => getTier(o.key) >= 2);

  return [{
    match:          `${event.homeTeam} vs ${event.awayTeam}`,
    sport:          event.sportTitle,
    arbPercentage:  arbPct,
    isGenuineArb:   arbFraction < 1.0,
    hasPinnacle,
    hasSharpSoft,
    riskLevel:      arbFraction < 1.0 ? 'LOW' : 'MEDIUM',
    outcomes: outcomes.map(([name, o]) => ({
      outcome:       name,
      odds:          o.odds,
      bookmaker:     o.title,
      impliedProb:   parseFloat(((1 / o.odds) * 100).toFixed(2)),
      depositMethod: '',
      bookmakerUrl:  '',
      tier:          getTier(o.key),
    })),
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

  const allArbs: ReturnType<typeof detectArbitrage> = [];
  const log: string[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;

  for (const sportKey of AUTO_SCAN_SPORTS) {
    const result = await smartScan(sportKey);
    quotaUsed = result.quotaUsed || quotaUsed;
    quotaRemaining = result.quotaRemaining || quotaRemaining;
    log.push(...result.debug);

    for (const event of result.events) {
      allArbs.push(...detectArbitrage(event));
    }
  }

  // Send Telegram alerts
  const genuineArbs = allArbs.filter(a => a.isGenuineArb);
  const nearArbs    = allArbs.filter(a => !a.isGenuineArb);
  let telegramSent  = 0;

  // Alert for every genuine arb (guaranteed profit)
  for (const arb of genuineArbs) {
    const msg = formatArbAlert(arb);
    if (await sendTelegramAlert(msg)) telegramSent++;
  }

  // Summary for near-arbs (only if no genuine arbs found)
  if (nearArbs.length > 0 && genuineArbs.length === 0) {
    const best = nearArbs.sort((a, b) => b.arbPercentage - a.arbPercentage)[0];
    const summary = `\u{1F50D} <b>Auto-Scan Complete</b>\n\n` +
      `\u{1F4CA} ${nearArbs.length} near-arb opportunities\n` +
      `Best: <b>${best.match}</b> (${best.arbPercentage.toFixed(2)}%)\n` +
      (best.hasPinnacle ? `\u{1F4A0} Pinnacle involved\n` : '') +
      `\n\u{1F517} <a href="https://sureedge-ai.vercel.app">View in SureEdge AI</a>`;
    if (await sendTelegramAlert(summary)) telegramSent++;
  }

  return success({
    scannedAt:     new Date().toISOString(),
    sportsScanned: AUTO_SCAN_SPORTS.length,
    genuineArbs:   genuineArbs.length,
    nearArbs:      nearArbs.length,
    telegramSent,
    quotaUsed,
    quotaRemaining,
    log,
  });
}
