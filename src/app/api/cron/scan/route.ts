export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert, formatArbAlert } from '@/lib/telegram';
import { detectArbitrage, sortArbs, DetectedArb } from '@/lib/arb-detector';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDSPAPI_BASE = 'https://api.oddspapi.io/v4';
const SPORT_ROTATION = ['basketball_nba', 'soccer_epl', 'baseball_mlb'];
const MIN_ARB_ALERT = 2.5;

// OddsPapi sport IDs (VERIFIED from /v4/sports)
const ODDSPAPI_SPORT_IDS: Record<string, number> = {
  'basketball_nba': 11,
  'soccer_epl':     10,
  'baseball_mlb':   13,
  'icehockey_nhl':  15,
  'tennis_atp_french_open': 12,
  'mma_mixed_martial_arts': 20,
};

// Fetch from OddsPapi — 1 request = ALL fixtures with ALL 350+ bookmakers
async function fetchOddsPapi(sportKey: string, log: string[]) {
  const apiKey = process.env.ODDSPAPI_API_KEY;
  if (!apiKey) { log.push('OddsPapi: ODDSPAPI_API_KEY not set'); return []; }

  const sportId = ODDSPAPI_SPORT_IDS[sportKey];
  if (!sportId) { log.push(`OddsPapi: unknown sport ${sportKey}`); return []; }

  try {
    // Get fixtures with odds for next 24 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const url = `${ODDSPAPI_BASE}/fixtures?` + new URLSearchParams({
      apiKey,
      sportId: String(sportId),
      hasOdds: 'true',
      from: now.toISOString(),
      to: tomorrow.toISOString(),
    });

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.push(`OddsPapi fixtures: ${res.status} — ${body.slice(0, 100)}`);
      return [];
    }

    const fixtures = await res.json();
    const withOdds = (Array.isArray(fixtures) ? fixtures : []).filter((f: Record<string, unknown>) => f.hasOdds);
    log.push(`OddsPapi: ${withOdds.length} fixtures with odds`);

    if (withOdds.length === 0) return [];

    // Get odds for top 3 fixtures (each call returns ALL 350+ bookmakers)
    const events: { id: string; sport_title: string; home_team: string; away_team: string; commence_time: string; bookmakers: { key: string; title: string; markets: { key: string; outcomes: { name: string; price: number }[] }[] }[] }[] = [];
    const marketId = sportKey.startsWith('soccer') ? '101' : '111';

    for (const fixture of withOdds.slice(0, 3)) {
      const fixtureId = fixture.fixtureId;
      if (!fixtureId) continue;

      const oddsUrl = `${ODDSPAPI_BASE}/odds?` + new URLSearchParams({
        apiKey,
        fixtureId: String(fixtureId),
        oddsFormat: 'decimal',
      });

      const oddsRes = await fetch(oddsUrl, { cache: 'no-store' });
      if (!oddsRes.ok) { log.push(`OddsPapi odds ${fixtureId}: ${oddsRes.status}`); continue; }

      const oddsData = await oddsRes.json();
      const bookmakerOdds = oddsData.bookmakerOdds || {};

      const homeTeam = fixture.participant1Name || '';
      const awayTeam = fixture.participant2Name || '';

      // Convert OddsPapi format to The Odds API format (what arb-detector expects)
      const bookmakers: { key: string; title: string; markets: { key: string; outcomes: { name: string; price: number }[] }[] }[] = [];
      for (const [slug, bmData] of Object.entries(bookmakerOdds)) {
        const bm = bmData as Record<string, unknown>;
        const markets = bm.markets as Record<string, Record<string, unknown>> | undefined;
        if (!markets || !markets[marketId]) continue;

        const outcomesObj = (markets[marketId] as Record<string, unknown>).outcomes as Record<string, Record<string, unknown>> | undefined;
        if (!outcomesObj) continue;

        const outcomes: { name: string; price: number }[] = [];
        for (const [outcomeId, outcomeData] of Object.entries(outcomesObj)) {
          const od = outcomeData as Record<string, unknown>;
          const players = od.players as Record<string, Record<string, unknown>> | undefined;
          const price = players?.['0']?.price as number | undefined;

          // Map outcome IDs to team names
          let name = '';
          if (marketId === '101') {
            // Soccer 1X2
            if (outcomeId === '101') name = homeTeam;
            else if (outcomeId === '102') name = 'Draw';
            else if (outcomeId === '103') name = awayTeam;
          } else {
            // Moneyline
            if (outcomeId === '111') name = homeTeam;
            else if (outcomeId === '112') name = awayTeam;
          }

          if (!name) name = (od.outcomeName as string) || `Outcome ${outcomeId}`;
          if (price && price > 1.01) outcomes.push({ name, price });
        }

        if (outcomes.length >= 2) {
          bookmakers.push({
            key: slug.toLowerCase(),
            title: slug,
            markets: [{ key: 'h2h', outcomes }],
          });
        }
      }

      if (bookmakers.length >= 2) {
        events.push({
          id: String(fixtureId),
          sport_title: fixture.sportName || sportKey,
          home_team: homeTeam,
          away_team: awayTeam,
          commence_time: fixture.startTime || new Date().toISOString(),
          bookmakers,
        });
        log.push(`  ${homeTeam} vs ${awayTeam}: ${bookmakers.length} bookmakers`);
      }
    }

    return events;
  } catch (err) {
    log.push(`OddsPapi error: ${err}`);
    return [];
  }
}

// Fallback: The Odds API (only if OddsPapi returns nothing AND credits > 5)
async function fetchOddsAPI(sportKey: string, log: string[]) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) { log.push('Odds API: not configured'); return { events: [], quotaRemaining: 0 }; }

  try {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'us,uk,eu,au',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, { cache: 'no-store' });
    const quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

    if (quotaRemaining < 5) {
      log.push(`Odds API: PAUSED — only ${quotaRemaining} credits left`);
      return { events: [], quotaRemaining };
    }

    if (!res.ok) { log.push(`Odds API: ${res.status}`); return { events: [], quotaRemaining }; }

    const events = await res.json();
    log.push(`Odds API (backup): ${events.length} events (${quotaRemaining} credits left)`);
    return { events, quotaRemaining };
  } catch (err) {
    log.push(`Odds API error: ${err}`);
    return { events: [], quotaRemaining: 0 };
  }
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

  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const rotationIndex = Math.floor(minuteOfDay / 15) % SPORT_ROTATION.length;
  const sportKey = SPORT_ROTATION[rotationIndex];

  const log: string[] = [`Scanning: ${sportKey}`];
  let quotaRemaining = 0;

  // PRIMARY: OddsPapi (225 requests left, 350+ bookmakers per fixture)
  let events = await fetchOddsPapi(sportKey, log);

  // BACKUP: The Odds API (only if OddsPapi returned nothing)
  if (events.length === 0) {
    const backup = await fetchOddsAPI(sportKey, log);
    events = backup.events;
    quotaRemaining = backup.quotaRemaining;
  }

  // Detect arbs
  let allArbs: DetectedArb[] = [];
  for (const event of events) {
    allArbs.push(...detectArbitrage(event, 0));
  }
  allArbs = sortArbs(allArbs);

  // Telegram: only genuine arbs ≥ 2.5%
  let telegramSent = 0;
  for (const arb of allArbs) {
    if (arb.isGenuineArb && arb.arbPercentage >= MIN_ARB_ALERT) {
      if (await sendTelegramAlert(formatArbAlert(arb))) telegramSent++;
    }
  }

  const genuine = allArbs.filter(a => a.isGenuineArb);
  log.push(`Found: ${genuine.length} genuine, ${allArbs.length} total, Telegram: ${telegramSent}`);

  // Log top 3 for debugging
  for (const arb of allArbs.slice(0, 3)) {
    const books = arb.outcomes.map(o => `${o.bookmaker}@${o.odds}`).join(' vs ');
    log.push(`  ${arb.arbPercentage.toFixed(2)}% ${arb.accessTag} ${arb.match} [${books}]`);
  }

  return success({
    scannedAt:     new Date().toISOString(),
    sport:         sportKey,
    source:        events.length > 0 ? (log.some(l => l.includes('OddsPapi:')) && !log.some(l => l.includes('Odds API (backup)')) ? 'OddsPapi' : 'Odds API') : 'none',
    eventsScanned: events.length,
    genuineArbs:   genuine.length,
    alertableArbs: genuine.filter(a => a.arbPercentage >= MIN_ARB_ALERT).length,
    telegramSent,
    quotaRemaining,
    topArbs:       allArbs.slice(0, 5),
    log,
  });
}
