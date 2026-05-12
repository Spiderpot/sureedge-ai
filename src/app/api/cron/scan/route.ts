export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { detectArbitrage, sortArbs, DetectedArb } from '@/lib/arb-detector';
import { smartScan } from '@/lib/odds-engine';
import type { NormalizedOdds } from '@/lib/odds-engine';

// Sports ranked by volatility — highest divergence frequency first
const SPORT_ROTATION = [
  'table_tennis',
  'mma_mixed_martial_arts',
  'basketball_nba',
  'icehockey_nhl',
  'tennis_atp_french_open',
  'baseball_mlb',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_epl',
];

// Alert thresholds by access level
const THRESHOLDS = {
  YOUR_BOOKS: 0.7,   // Pinnacle + 1xBet — both funded, act immediately
  NG_ACCESS:  1.5,   // NG accessible without VPN
  VPN:        3.0,   // Needs VPN — only worth high %
};

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

export async function GET(request: NextRequest) {
  const url          = new URL(request.url);
  const authHeader   = request.headers.get('authorization');
  const cronSecret   = process.env.CRON_SECRET;
  const querySecret  = url.searchParams.get('secret');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isAuthed     = cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!isVercelCron && !isAuthed && cronSecret) return error('Unauthorized', 401);

  // Rotate by time — 12-min slots across all sports
  const sportParam  = url.searchParams.get('sport');
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const sportKey    = sportParam || SPORT_ROTATION[Math.floor(minuteOfDay / 12) % SPORT_ROTATION.length];

  const log: string[] = [`Sport: ${sportKey}`];

  const result = await smartScan(sportKey);
  log.push(`Source: ${result.sources.join(', ')}`);
  log.push(...result.debug);

  let allArbs: DetectedArb[] = [];
  for (const event of result.events) {
    // Include divergences down to -1% (near-arbs worth monitoring)
    allArbs.push(...detectArbitrage(toArbEvent(event), -1));
  }
  allArbs = sortArbs(allArbs);

  // Send alerts based on access level thresholds
  let telegramSent = 0;
  for (const arb of allArbs) {
    if (!arb.isGenuineArb) continue; // Only genuine arbs trigger alerts

    const threshold = arb.accessTag.includes('YOUR BOOKS') ? THRESHOLDS.YOUR_BOOKS :
                      arb.accessTag.includes('NG')         ? THRESHOLDS.NG_ACCESS :
                      THRESHOLDS.VPN;

    if (arb.arbPercentage >= threshold) {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    }
  }

  const genuine = allArbs.filter(a => a.isGenuineArb);
  const execute = allArbs.filter(a => a.tier === 'EXECUTE');

  log.push(`Found: ${genuine.length} genuine, ${allArbs.length} total`);
  log.push(`Edge scores: ${allArbs.slice(0, 3).map(a => `${a.edgeScore}/100`).join(', ')}`);
  log.push(`Telegram: ${telegramSent}`);

  for (const arb of allArbs.slice(0, 3)) {
    log.push(`  ${arb.arbPercentage.toFixed(3)}% [${arb.tier}][Edge:${arb.edgeScore}] ${arb.match} — ${arb.outcomes.map(o => `${o.bookmaker}@${o.odds}`).join(' vs ')}`);
  }

  return success({
    scannedAt:     new Date().toISOString(),
    sport:         sportKey,
    sources:       result.sources,
    eventsScanned: result.events.length,
    genuineArbs:   genuine.length,
    executeArbs:   execute.length,
    topEdgeScore:  allArbs[0]?.edgeScore ?? 0,
    telegramSent,
    topArbs:       allArbs.slice(0, 5),
    log,
  });
}
