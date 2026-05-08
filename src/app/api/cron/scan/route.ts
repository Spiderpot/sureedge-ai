export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

const SPORT_MAP: Record<string, string> = {
  basketball: 'basketball_nba',
  baseball:   'baseball_mlb',
  hockey:     'icehockey_nhl',
  football:   'soccer_epl',
  tennis:     'tennis_wta_french_open',
  mma:        'mma_mixed_martial_arts',
};

// Scan these sports automatically
const AUTO_SCAN_SPORTS = [
  'basketball_nba',
  'baseball_mlb',
  'icehockey_nhl',
];

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

  const bestOdds: Record<string, { odds: number; bookmaker: string; title: string }> = {};
  for (const bm of event.bookmakers) {
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const outcome of market.outcomes) {
      if (!bestOdds[outcome.name] || outcome.price > bestOdds[outcome.name].odds) {
        bestOdds[outcome.name] = { odds: outcome.price, bookmaker: bm.key, title: bm.title };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction < 1.05) {
    return [{
      match:         `${event.home_team} vs ${event.away_team}`,
      sport:         event.sport_title,
      arbPercentage: arbPct,
      isGenuineArb:  arbFraction < 1.0,
      riskLevel:     arbFraction < 1.0 ? 'LOW' : 'MEDIUM',
      outcomes: outcomes.map(([name, o]) => ({
        outcome:    name,
        odds:       o.odds,
        bookmaker:  o.title,
        impliedProb: parseFloat(((1 / o.odds) * 100).toFixed(2)),
      })),
    }];
  }

  return [];
}

export async function GET(request: NextRequest) {
  // Protect cron endpoint with secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const querySecret = new URL(request.url).searchParams.get('secret');

  // Allow: Vercel cron header, Bearer token, or ?secret= query param
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isAuthed     = cronSecret && (
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret
  );

  if (!isVercelCron && !isAuthed && cronSecret) {
    return error('Unauthorized', 401);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return error('ODDS_API_KEY not configured', 500);

  const allArbs: ReturnType<typeof detectArbitrage> = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;
  const log: string[] = [];

  for (const sportKey of AUTO_SCAN_SPORTS) {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
        apiKey,
        regions:    'us,uk,eu,au',
        markets:    'h2h',
        oddsFormat: 'decimal',
        dateFormat: 'iso',
      });

      const res = await fetch(url, { cache: 'no-store' });
      quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
      quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

      if (!res.ok) {
        log.push(`${sportKey}: HTTP ${res.status}`);
        continue;
      }

      const events: Event[] = await res.json();
      log.push(`${sportKey}: ${events.length} events`);

      for (const event of events) {
        allArbs.push(...detectArbitrage(event));
      }
    } catch (e) {
      log.push(`${sportKey}: ${String(e)}`);
    }
  }

  // Send Telegram alerts for genuine arbs (positive profit)
  const genuineArbs = allArbs.filter(a => a.isGenuineArb);
  const nearArbs    = allArbs.filter(a => !a.isGenuineArb);
  let telegramSent  = 0;

  if (genuineArbs.length > 0) {
    // Send individual alert for each genuine arb
    for (const arb of genuineArbs) {
      const msg = formatArbAlert(arb);
      const sent = await sendTelegramAlert(msg);
      if (sent) telegramSent++;
    }
  }

  // Send summary if near-arbs found (batch into one message)
  if (nearArbs.length > 0 && genuineArbs.length === 0) {
    const summary = `🔍 <b>Auto-Scan Report</b>\n\n` +
      `📊 ${nearArbs.length} near-arb opportunities found\n` +
      `Best: <b>${nearArbs[0].match}</b> (${nearArbs[0].arbPercentage.toFixed(2)}%)\n\n` +
      `🔗 <a href="https://sureedge-ai.vercel.app">View in SureEdge AI</a>`;
    await sendTelegramAlert(summary);
    telegramSent++;
  }

  // No opportunities at all
  if (allArbs.length === 0) {
    // Only notify once per hour (don't spam)
    const minute = new Date().getMinutes();
    if (minute < 15) {
      await sendTelegramAlert('🔍 Auto-scan complete — no opportunities right now. Will scan again in 15 min.');
    }
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
    arbs: allArbs,
  });
}
