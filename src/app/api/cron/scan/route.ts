export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { detectArbitrage, sortArbs } from '@/lib/arb-detector';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_ROTATION = ['basketball_nba', 'soccer_epl', 'baseball_mlb'];
const MIN_ARB_ALERT = 2.5; // Only alert ≥ 2.5% arbs

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

  // Rotate sport each scan
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const rotationIndex = Math.floor(minuteOfDay / 15) % SPORT_ROTATION.length;
  const sportKey = SPORT_ROTATION[rotationIndex];

  const log: string[] = [`Scanning: ${sportKey}`];

  try {
    // ALL 4 regions — this is what finds big arbs
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'us,uk,eu,au',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, { cache: 'no-store' });
    const quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
    const quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);
    log.push(`Credits: ${quotaUsed} used, ${quotaRemaining} left`);

    if (quotaRemaining < 5) {
      log.push('PAUSED — credits critically low');
      return success({ scannedAt: new Date().toISOString(), paused: true, quotaRemaining, log });
    }

    if (!res.ok) {
      log.push(`API error: ${res.status}`);
      return success({ scannedAt: new Date().toISOString(), log });
    }

    const events = await res.json();
    const totalBookmakers = events.reduce((s: number, e: { bookmakers: unknown[] }) => s + e.bookmakers.length, 0);
    log.push(`${sportKey}: ${events.length} events, ${totalBookmakers} bookmakers`);

    // Detect arbs using professional engine
    let allArbs = events.flatMap((event: Parameters<typeof detectArbitrage>[0]) =>
      detectArbitrage(event, 0) // Get everything, filter for alerts below
    );

    allArbs = sortArbs(allArbs);

    // Telegram: only genuine arbs ≥ 2.5%
    let telegramSent = 0;
    const alertableArbs = allArbs.filter(a => a.isGenuineArb && a.arbPercentage >= MIN_ARB_ALERT);

    for (const arb of alertableArbs) {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    }

    // Stats
    const genuine = allArbs.filter(a => a.isGenuineArb);
    const fundedArbs = genuine.filter(a => a.bothFunded);
    const vpnArbs = genuine.filter(a => a.accessTag.includes('VPN'));

    log.push(`Found: ${genuine.length} genuine arbs, ${fundedArbs.length} on your books, ${vpnArbs.length} VPN`);
    log.push(`Alertable (≥${MIN_ARB_ALERT}%): ${alertableArbs.length}, Telegram: ${telegramSent}`);

    // Log top 3 arbs for debugging
    for (const arb of allArbs.slice(0, 3)) {
      const books = arb.outcomes.map(o => `${o.bookmaker}@${o.odds}`).join(' vs ');
      log.push(`  ${arb.arbPercentage.toFixed(2)}% ${arb.accessTag} ${arb.match} [${books}]`);
    }

    return success({
      scannedAt:      new Date().toISOString(),
      sport:          sportKey,
      eventsScanned:  events.length,
      totalBookmakers,
      allArbs:        allArbs.length,
      genuineArbs:    genuine.length,
      fundedArbs:     fundedArbs.length,
      vpnArbs:        vpnArbs.length,
      alertableArbs:  alertableArbs.length,
      telegramSent,
      quotaUsed,
      quotaRemaining,
      topArbs:        allArbs.slice(0, 5),
      log,
    });
  } catch (e) {
    log.push(`Error: ${String(e)}`);
    return success({ scannedAt: new Date().toISOString(), log });
  }
}
