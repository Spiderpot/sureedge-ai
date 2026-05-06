export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Active sports in May — EPL is OFF season, use these instead
const SPORT_MAP: Record<string, string> = {
  football:   'soccer_uefa_champs_league',
  basketball: 'basketball_nba',
  tennis:     'tennis_wta_french_open',
  baseball:   'baseball_mlb',
  hockey:     'icehockey_nhl',
  mma:        'mma_mixed_martial_arts',
  all:        'all',
};

// Sports to scan when "all" selected — ordered by arb likelihood
const ALL_SPORTS = [
  'basketball_nba',
  'baseball_mlb',
  'mma_mixed_martial_arts',
  'soccer_uefa_champs_league',
  'icehockey_nhl',
];

interface OddsAPIBookmaker {
  key: string;
  title: string;
  markets: {
    key: string;
    outcomes: { name: string; price: number }[];
  }[];
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

// Fix: Find BEST odds for each outcome across ALL bookmakers simultaneously
function detectArbitrage(event: OddsAPIEvent) {
  const surebets: Record<string, unknown>[] = [];

  if (event.bookmakers.length < 2) return surebets;

  // Build best odds map across ALL bookmakers
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

  // Real arb: sum of (1/bestOdds) < 1
  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  // Show genuine arbs (arbFraction < 1.0) AND near-arbs (< 1.02) as opportunities
  if (arbFraction < 1.02) {
    const isGenuineArb = arbFraction < 1.0;
    const riskLevel = isGenuineArb
      ? (arbPct > 3 ? 'LOW' : 'LOW')
      : 'MEDIUM';

    surebets.push({
      id:            `arb_${event.id}_${Date.now()}`,
      eventId:       event.id,
      match:         `${event.home_team} vs ${event.away_team}`,
      sport:         event.sport_title,
      league:        event.sport_title,
      commenceTime:  event.commence_time,
      arbPercentage: arbPct,
      arbFraction:   parseFloat(arbFraction.toFixed(6)),
      roi:           arbPct,
      isGenuineArb,
      riskLevel,
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

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'all';

    if (!apiKey) {
      return success({
        totalFound: 0, quotaUsed: 0, quotaRemaining: 0, surebets: [],
        message: 'ODDS_API_KEY not configured.',
        demoMode: true,
      });
    }

    const sportsToScan = sport === 'all'
      ? ALL_SPORTS
      : [SPORT_MAP[sport] ?? 'basketball_nba'];

    const allSurebets: Record<string, unknown>[] = [];
    let quotaUsed = 0;
    let quotaRemaining = 0;
    const errors: string[] = [];

    for (const sportKey of sportsToScan) {
      try {
        const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
          apiKey,
          regions:    'uk,us,eu,au',
          markets:    'h2h',
          oddsFormat: 'decimal',
          dateFormat: 'iso',
        });

        // No caching — each scan must get fresh odds
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' },
        });

        quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
        quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

        if (!res.ok) {
          if (res.status === 401) return error('Invalid ODDS_API_KEY', 401);
          if (res.status === 422) { errors.push(`${sportKey}: no events`); continue; }
          if (res.status === 429) return error('Odds API quota exceeded. Try again tomorrow.', 429);
          errors.push(`${sportKey}: HTTP ${res.status}`);
          continue;
        }

        const events: OddsAPIEvent[] = await res.json();

        for (const event of events) {
          allSurebets.push(...detectArbitrage(event));
        }
      } catch (e) {
        errors.push(`${sportKey}: ${String(e)}`);
      }
    }

    allSurebets.sort((a, b) => (b.arbPercentage as number) - (a.arbPercentage as number));

    return success({
      totalFound:     allSurebets.length,
      quotaUsed,
      quotaRemaining,
      sportsScanned:  sportsToScan.length,
      errors:         errors.length ? errors : undefined,
      surebets:       allSurebets,
      scannedAt:      new Date().toISOString(),
    });
  } catch (err) {
    console.error('Surebet scan error:', err);
    return error('Scan failed', 500);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
