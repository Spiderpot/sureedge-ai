/**
 * SureEdge AI — Multi-API Odds Engine v2
 * 
 * PRIMARY:  OddsPapi — 250 req/month, 350+ bookmakers per request (Pinnacle+1xBet+22Bet)
 * BACKUP:   The Odds API — 89 credits left, 2 credits/scan, ~20 bookmakers
 * REMOVED:  SharpAPI (US-only, no Pinnacle/1xBet), Odds-API.io (unverified)
 */

export interface NormalizedOdds {
  eventId: string;
  sport: string;
  sportTitle: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: {
    key: string;
    title: string;
    market: string;
    outcomes: { name: string; price: number }[];
  }[];
}

// ─── Cache ──────────────────────────────────────────────────────────────

interface CacheEntry { data: NormalizedOdds[]; timestamp: number; source: string }
const cache = new Map<string, CacheEntry>();

function getCacheTTL(commenceTime?: string): number {
  if (!commenceTime) return 120_000;
  const ms = new Date(commenceTime).getTime() - Date.now();
  if (ms < 0)          return 15_000;   // Live
  if (ms < 3_600_000)  return 30_000;   // <1hr
  if (ms < 10_800_000) return 120_000;  // <3hr
  return 300_000;                        // >3hr
}

function getFromCache(key: string, ttl: number): NormalizedOdds[] | null {
  const e = cache.get(key);
  if (!e || Date.now() - e.timestamp > ttl) { cache.delete(key); return null; }
  return e.data;
}

function setCache(key: string, data: NormalizedOdds[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source });
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) cache.delete(oldest[i][0]);
  }
}

// ─── OddsPapi Sport ID mapping ──────────────────────────────────────────

const ODDSPAPI_SPORT_MAP: Record<string, string> = {
  'soccer_epl':                '1',    // Soccer
  'soccer_spain_la_liga':      '1',
  'soccer_italy_serie_a':     '1',
  'soccer_germany_bundesliga': '1',
  'soccer_france_ligue_one':   '1',
  'soccer_uefa_champs_league': '1',
  'basketball_nba':            '2',    // Basketball
  'baseball_mlb':              '3',    // Baseball
  'icehockey_nhl':             '4',    // Ice Hockey
  'tennis_atp_french_open':    '5',    // Tennis
  'tennis_wta_french_open':    '5',
  'mma_mixed_martial_arts':    '7',    // MMA
};

// ─── API 1: OddsPapi (PRIMARY — 350+ books per request) ────────────────

async function fetchOddsPapi(sportKey: string): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDSPAPI_API_KEY;
  if (!apiKey) return [];

  const sportId = ODDSPAPI_SPORT_MAP[sportKey];
  if (!sportId) return [];

  try {
    // Step 1: Get fixtures for this sport
    const fixturesRes = await fetch(
      `https://api.oddspapi.io/v4/fixtures?apiKey=${apiKey}&sportId=${sportId}&status=prematch&limit=20`,
      { cache: 'no-store' }
    );

    if (!fixturesRes.ok) {
      console.error(`OddsPapi fixtures: ${fixturesRes.status}`);
      return [];
    }

    const fixturesData = await fixturesRes.json();
    const fixtures = Array.isArray(fixturesData) ? fixturesData : (fixturesData.data || fixturesData.fixtures || []);

    const events: NormalizedOdds[] = [];

    // Step 2: Get odds for each fixture (each call returns ALL 350+ bookmakers)
    // Limit to 5 fixtures per scan to conserve the 250 req/month limit
    const fixtureSlice = fixtures.slice(0, 5);

    for (const fixture of fixtureSlice) {
      const fixtureId = fixture.id || fixture.fixtureId;
      if (!fixtureId) continue;

      try {
        const oddsRes = await fetch(
          `https://api.oddspapi.io/v4/odds?apiKey=${apiKey}&fixtureId=${fixtureId}`,
          { cache: 'no-store' }
        );

        if (!oddsRes.ok) continue;
        const oddsData = await oddsRes.json();

        const bookmakerOdds = oddsData.bookmakerOdds || oddsData.data?.bookmakerOdds || {};
        const ev: NormalizedOdds = {
          eventId:      String(fixtureId),
          sport:        sportKey,
          sportTitle:   fixture.sportName || fixture.sport || sportKey,
          homeTeam:     fixture.homeTeamName || fixture.home?.name || fixture.participants?.[0]?.name || '',
          awayTeam:     fixture.awayTeamName || fixture.away?.name || fixture.participants?.[1]?.name || '',
          commenceTime: fixture.startTime || fixture.commence_time || fixture.scheduled || new Date().toISOString(),
          bookmakers:   [],
        };

        // Parse bookmaker odds — OddsPapi structure:
        // bookmakerOdds.{slug}.markets.{marketId}.outcomes.{outcomeId}.players.0.price
        // Market 101 = 1X2 (soccer), Market 111 = Moneyline (basketball/baseball)
        const marketId = sportId === '1' ? '101' : '111';

        for (const [slug, bmData] of Object.entries(bookmakerOdds)) {
          const bm = bmData as Record<string, unknown>;
          const markets = bm.markets as Record<string, Record<string, unknown>> | undefined;
          if (!markets || !markets[marketId]) continue;

          const outcomesObj = (markets[marketId] as Record<string, unknown>).outcomes as Record<string, Record<string, unknown>> | undefined;
          if (!outcomesObj) continue;

          const outcomes: { name: string; price: number }[] = [];
          for (const [, outcomeData] of Object.entries(outcomesObj)) {
            const od = outcomeData as Record<string, unknown>;
            const players = od.players as Record<string, Record<string, unknown>> | undefined;
            const price = players?.['0']?.price as number | undefined;
            const name = (od.outcomeName as string) || '';

            if (price && price > 1.01 && name) {
              outcomes.push({ name, price });
            }
          }

          if (outcomes.length >= 2) {
            ev.bookmakers.push({
              key:     slug.toLowerCase(),
              title:   slug.charAt(0).toUpperCase() + slug.slice(1),
              market:  'h2h',
              outcomes,
            });
          }
        }

        if (ev.bookmakers.length >= 2 && ev.homeTeam) {
          events.push(ev);
        }
      } catch (err) {
        console.error(`OddsPapi odds fetch error:`, err);
      }
    }

    return events;
  } catch (err) {
    console.error('OddsPapi error:', err);
    return [];
  }
}

// ─── API 2: The Odds API (BACKUP — conserve credits) ───────────────────

async function fetchTheOddsAPI(sportKey: string): Promise<{ events: NormalizedOdds[]; quotaUsed: number; quotaRemaining: number }> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { events: [], quotaUsed: 0, quotaRemaining: 0 };

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'eu,uk',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, { cache: 'no-store' });
    const quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
    const quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

    if (!res.ok) return { events: [], quotaUsed, quotaRemaining };

    const data = await res.json();
    const events: NormalizedOdds[] = data.map((item: Record<string, unknown>) => ({
      eventId:      String(item.id),
      sport:        sportKey,
      sportTitle:   String(item.sport_title),
      homeTeam:     String(item.home_team),
      awayTeam:     String(item.away_team),
      commenceTime: String(item.commence_time),
      bookmakers:   ((item.bookmakers || []) as Record<string, unknown>[]).map((bm) => ({
        key:     String(bm.key),
        title:   String(bm.title),
        market:  'h2h',
        outcomes: ((bm.markets as Record<string, unknown>[])?.[0]?.outcomes as { name: string; price: number }[] || []).map((o) => ({
          name: o.name, price: o.price,
        })),
      })),
    }));

    return { events, quotaUsed, quotaRemaining };
  } catch (err) {
    console.error('The Odds API error:', err);
    return { events: [], quotaUsed: 0, quotaRemaining: 0 };
  }
}

// ─── Smart Router ───────────────────────────────────────────────────────

export interface ScanResult {
  events: NormalizedOdds[];
  sources: string[];
  quotaUsed: number;
  quotaRemaining: number;
  debug: string[];
  cached: boolean;
}

export async function smartScan(sportKey: string): Promise<ScanResult> {
  const cacheKey = `scan:${sportKey}`;
  const ttl = getCacheTTL();
  const debug: string[] = [];
  const sources: string[] = [];

  // Cache check
  const cached = getFromCache(cacheKey, ttl);
  if (cached) {
    debug.push(`Cache hit: ${cached.length} events`);
    return { events: cached, sources: ['cache'], quotaUsed: 0, quotaRemaining: 0, debug, cached: true };
  }

  let allEvents: NormalizedOdds[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;

  // Priority 1: OddsPapi (350+ bookmakers per request, free)
  const oddspapiEvents = await fetchOddsPapi(sportKey);
  if (oddspapiEvents.length > 0) {
    allEvents.push(...oddspapiEvents);
    sources.push('OddsPapi');
    debug.push(`OddsPapi: ${oddspapiEvents.length} events, ${oddspapiEvents.reduce((s, e) => s + e.bookmakers.length, 0)} total bookmakers`);
  } else {
    debug.push('OddsPapi: no results or not configured');
  }

  // Priority 2: The Odds API (backup, conserve credits)
  const oddsApiKey = process.env.ODDS_API_KEY;
  if (oddsApiKey && allEvents.length === 0) {
    // Only use when OddsPapi returns nothing
    const oddsResult = await fetchTheOddsAPI(sportKey);
    quotaUsed = oddsResult.quotaUsed;
    quotaRemaining = oddsResult.quotaRemaining;
    if (oddsResult.events.length > 0) {
      allEvents.push(...oddsResult.events);
      sources.push('The Odds API');
      debug.push(`The Odds API (fallback): ${oddsResult.events.length} events (${quotaRemaining} credits left)`);
    } else {
      debug.push(`The Odds API: no events (${quotaRemaining} credits left)`);
    }
  }

  // Cache results
  if (allEvents.length > 0) {
    setCache(cacheKey, allEvents, sources.join('+'));
  }

  debug.push(`Total: ${allEvents.length} events from ${sources.length} source(s)`);
  return { events: allEvents, sources, quotaUsed, quotaRemaining, debug, cached: false };
}
