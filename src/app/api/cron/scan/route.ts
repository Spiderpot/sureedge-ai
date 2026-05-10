export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { detectArbitrage, sortArbs, DetectedArb } from '@/lib/arb-detector';
import { smartScan, NormalizedOdds } from '@/lib/odds-engine';

function toArbEvent(e: NormalizedOdds) {
  return {
    id: e.eventId, sport_title: e.sportTitle,
    home_team: e.homeTeam, away_team: e.awayTeam,
    commence_time: e.commenceTime,
    bookmakers: e.bookmakers.map(bm => ({
      key: bm.key, title: bm.title,
      markets: [{ key: bm.market, outcomes: bm.outcomes }],
    })),
  };
}

const SPORT_ROTATION = ['basketball_nba', 'soccer_epl', 'baseball_mlb'];
const MIN_ARB_ALERT = 2.5;

export async function GET(request: NextRequest) {
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET;
  const querySecret = new URL(request.url).searchParams.get('secret');
  const sportParam  = new URL(request.url).searchParams.get('sport');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isAuthed = cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!isVercelCron && !isAuthed && cronSecret) return error('Unauthorized', 401);

  // Sport: from param, or rotate by time
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const sportKey = sportParam || SPORT_ROTATION[Math.floor(minuteOfDay / 15) % SPORT_ROTATION.length];

  const log: string[] = [`Scanning: ${sportKey}`];

  // Fetch odds using multi-API engine
  const result = await smartScan(sportKey);
  log.push(`Source: ${result.sources.join(', ') || 'none'}`);
  log.push(...result.debug);

  // Detect arbs
  let allArbs: DetectedArb[] = [];
  for (const event of result.events) {
    allArbs.push(...detectArbitrage(toArbEvent(event), 0));
  }
  allArbs = sortArbs(allArbs);

  // Send Telegram alerts by tier
  let telegramSent = 0;
  for (const arb of allArbs) {
    if (!arb.isGenuineArb) continue;
    if (arb.tier === 'EXECUTE' && arb.arbPercentage >= MIN_ARB_ALERT) {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    } else if (arb.tier === 'VERIFY' || arb.tier === 'SUSPICIOUS') {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    }
  }

  const genuine = allArbs.filter(a => a.isGenuineArb);
  const execute = allArbs.filter(a => a.tier === 'EXECUTE');
  const verify  = allArbs.filter(a => a.tier === 'VERIFY');
  const sus     = allArbs.filter(a => a.tier === 'SUSPICIOUS');

  log.push(`Tiers: ${execute.length} EXECUTE, ${verify.length} VERIFY, ${sus.length} SUSPICIOUS`);
  log.push(`Genuine: ${genuine.length}, Telegram: ${telegramSent}`);

  for (const arb of allArbs.slice(0, 3)) {
    const books = arb.outcomes.map(o => `${o.bookmaker}@${o.odds}`).join(' vs ');
    log.push(`  ${arb.arbPercentage.toFixed(2)}% [${arb.tier}] ${arb.match} [${books}]`);
  }

  return success({
    scannedAt: new Date().toISOString(),
    sport: sportKey,
    sources: result.sources,
    eventsScanned: result.events.length,
    genuineArbs: genuine.length,
    executeArbs: execute.length,
    verifyArbs:  verify.length,
    suspiciousArbs: sus.length,
    telegramSent,
    topArbs: allArbs.slice(0, 5),
    log,
  });
}
