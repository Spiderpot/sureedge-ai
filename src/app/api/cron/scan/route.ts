export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { detectArbitrage, sortArbs, DetectedArb } from '@/lib/arb-detector';
import { smartScan } from '@/lib/odds-engine';

// All 11 sports in priority order
const SPORT_ROTATION = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'baseball_mlb',
  'tennis_atp_french_open',
  'basketball_nba',
  'icehockey_nhl',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_uefa_champs_league',
  'mma_mixed_martial_arts',
];

// Alert thresholds
const MIN_ARB_YOUR_BOOKS = 0.5;  // Both funded accounts
const MIN_ARB_NG         = 1.5;  // NG accessible
const MIN_ARB_VPN        = 3.0;  // VPN needed

function toArbEvent(e: { eventId: string; sportTitle: string; homeTeam: string; awayTeam: string; commenceTime: string; bookmakers: { key: string; title: string; market: string; outcomes: { name: string; price: number }[] }[] }) {
  return {
    id:           e.eventId,
    sport_title:  e.sportTitle,
    home_team:    e.homeTeam,
    away_team:    e.awayTeam,
    commence_time: e.commenceTime,
    bookmakers: e.bookmakers.map(bm => ({
      key: bm.key, title: bm.title,
      markets: [{ key: bm.market, outcomes: bm.outcomes }],
    })),
  };
}

export async function GET(request: NextRequest) {
  const url         = new URL(request.url);
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET;
  const querySecret = url.searchParams.get('secret');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isAuthed = cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!isVercelCron && !isAuthed && cronSecret) return error('Unauthorized', 401);

  // Sport: from ?sport= param OR rotate by time
  const sportParam   = url.searchParams.get('sport');
  const minuteOfDay  = new Date().getHours() * 60 + new Date().getMinutes();
  const sportKey     = sportParam || SPORT_ROTATION[Math.floor(minuteOfDay / 12) % SPORT_ROTATION.length];

  const log: string[] = [`Sport: ${sportKey}`];

  // Fetch odds
  const result = await smartScan(sportKey);
  log.push(`Source: ${result.sources.join(', ')}`);
  log.push(...result.debug);

  // Detect arbs
  let allArbs: DetectedArb[] = [];
  for (const event of result.events) {
    allArbs.push(...detectArbitrage(toArbEvent(event), 0));
  }
  allArbs = sortArbs(allArbs);

  // Send Telegram based on access level thresholds
  let telegramSent = 0;
  for (const arb of allArbs) {
    if (!arb.isGenuineArb) continue;

    const minPct = arb.accessTag.includes('YOUR BOOKS') ? MIN_ARB_YOUR_BOOKS :
                   arb.accessTag.includes('NG')         ? MIN_ARB_NG :
                   MIN_ARB_VPN;

    if (arb.arbPercentage >= minPct) {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    }
  }

  const genuine   = allArbs.filter(a => a.isGenuineArb);
  const execute   = allArbs.filter(a => a.tier === 'EXECUTE');
  const verify    = allArbs.filter(a => a.tier === 'VERIFY');
  const sus       = allArbs.filter(a => a.tier === 'SUSPICIOUS');

  log.push(`Arbs: ${genuine.length} genuine (${execute.length} EXECUTE, ${verify.length} VERIFY, ${sus.length} SUSPICIOUS)`);
  log.push(`Telegram: ${telegramSent}`);

  for (const arb of allArbs.slice(0, 3)) {
    const books = arb.outcomes.map(o => `${o.bookmaker}@${o.odds}`).join(' vs ');
    log.push(`  ${arb.arbPercentage.toFixed(3)}% [${arb.tier}] ${arb.accessTag} ${arb.match} — ${books}`);
  }

  return success({
    scannedAt:      new Date().toISOString(),
    sport:          sportKey,
    sources:        result.sources,
    eventsScanned:  result.events.length,
    genuineArbs:    genuine.length,
    executeArbs:    execute.length,
    verifyArbs:     verify.length,
    suspiciousArbs: sus.length,
    telegramSent,
    topArbs:        allArbs.slice(0, 5),
    log,
  });
}
