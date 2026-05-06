export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

const SPORT_MAP: Record<string, string> = {
  football:   'soccer_epl',
  soccer:     'soccer_epl',
  basketball: 'basketball_nba',
  tennis:     'tennis_wta_french_open',
  baseball:   'baseball_mlb',
  hockey:     'icehockey_nhl',
  mma:        'mma_mixed_martial_arts',
  all:        'all',
};

// Active sports May 2026 — 1 credit each (us region only)
const ALL_SPORTS = [
  'basketball_nba',
  'baseball_mlb',
];

interface OddsAPIBookmaker {
  key: string;
  title: string;
  markets: { key: string; outcomes: { name: string; price: number }[] }[];
}

interface OddsAPIEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsAPIBookmaker[];
}

function detectArbitrage(event: OddsAPIEvent) {
  const surebets: Record<string, unknown>[] = [];
  if (event.bookmakers.length < 2) return surebets;

  // Best odds across ALL bookmakers simultaneously
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
  if (outcomes.length < 2) return surebets;

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  // Show genuine arbs AND near-arbs (within 2%)
  if (arbFraction < 1.02) {
    surebets.push({
      id:            `arb_${event.id}_${Date.now()}`,
      eventId:       event.id,
      match:         `${event.home_team} vs ${event.away_team}`,
      sport:         event.sport_title,
      league:        event.sport_title,
      commenceTime:  event.commence_time,
      arbPercentage: arbPct,
      arbFraction:   parseFloat(arbFraction.toFixed(6)),
      profit:        arbPct,
      roi:           arbPct,
      isGenuineArb:  arbFraction < 1.0,
      riskLevel:     arbFraction < 1.0 ? 'LOW' : 'MEDIUM',
      bookmakerCount: event.bookmakers.length,
      outcomes: outcomes.map(([name, o]) => ({
        outcome:      name,
        odds:         o.odds,
        bookmaker:    o.title,
        bookmakerKey: o.bookmaker,
        impliedProb:  parseFloat(((1 / o.odds) * 100).toFixed(2)),
      })),
      status:     'active',
      detectedAt: new Date().toISOString(),
      expiresAt:  new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }

  return surebets;
}

async function handleScan(sport: string, apiKey: string) {
  // Fix: map sport name to API key correctly
  const sportLower = sport.toLowerCase();
  const sportsToScan = sportLower === 'all'
    ? ALL_SPORTS
    : [SPORT_MAP[sportLower] ?? 'basketball_nba'];

  const allSurebets: Record<string, unknown>[] = [];
  const debug: string[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;

  for (const sportKey of sportsToScan) {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'us',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
    quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

    if (!res.ok) {
      if (res.status === 401) return { err: 'Invalid ODDS_API_KEY — check Vercel env vars', code: 401 };
      if (res.status === 422) { debug.push(`${sportKey}: no events currently`); continue; }
      if (res.status === 429) return { err: 'Odds API quota exceeded', code: 429 };
      debug.push(`${sportKey}: HTTP ${res.status}`);
      continue;
    }

    const events: OddsAPIEvent[] = await res.json();
    debug.push(`${sportKey}: ${events.length} events, ${events.reduce((s, e) => s + e.bookmakers.length, 0)} total bookmakers`);

    for (const event of events) {
      allSurebets.push(...detectArbitrage(event));
    }
  }

  allSurebets.sort((a, b) => (b.arbPercentage as number) - (a.arbPercentage as number));

  return { surebets: allSurebets, quotaUsed, quotaRemaining, debug };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return success({ totalFound: 0, quotaUsed: 0, quotaRemaining: 0, surebets: [], message: 'ODDS_API_KEY not configured.', demoMode: true });

  try {
    const sport = new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport, apiKey);
    if ('err' in result) return error(result.err as string, result.code as number);
    return success({ totalFound: result.surebets!.length, quotaUsed: result.quotaUsed, quotaRemaining: result.quotaRemaining, surebets: result.surebets, debug: result.debug, scannedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return success({ totalFound: 0, quotaUsed: 0, quotaRemaining: 0, surebets: [], message: 'ODDS_API_KEY not configured.', demoMode: true });

  try {
    // Fix: read sport from POST body
    const body = await request.json().catch(() => ({})) as { sport?: string };
    const sport = body.sport || new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport, apiKey);
    if ('err' in result) return error(result.err as string, result.code as number);
    return success({ totalFound: result.surebets!.length, quotaUsed: result.quotaUsed, quotaRemaining: result.quotaRemaining, surebets: result.surebets, debug: result.debug, scannedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}
