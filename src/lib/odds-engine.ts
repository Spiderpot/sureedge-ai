/**
 * SureEdge AI — Multi-API Odds Engine v3
 * 
 * PRIMARY: OddsPapi — 250 req/month, 350+ bookmakers per fixture request
 *   Strategy: Use /odds-by-tournaments to get Pinnacle baseline (1 req),
 *   then /odds for specific fixtures with arb potential (1 req each, 350+ books)
 * 
 * BACKUP: The Odds API — 35 credits left, conserve for emergencies only
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

function getCacheTTL(): number { return 120_000; } // 2 min default

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

// ─── OddsPapi Tournament IDs ───────────────────────────────────────────

// OddsPapi uses sportId, not tournament IDs — more reliable
// VERIFIED sport IDs from OddsPapi /v4/sports endpoint
const ODDSPAPI_SPORT_IDS: Record<string, number> = {
  'soccer_epl':                10,   // Soccer
  'soccer_spain_la_liga':      10,
  'soccer_italy_serie_a':     10,
  'soccer_germany_bundesliga': 10,
  'soccer_france_ligue_one':   10,
  'soccer_uefa_champs_league': 10,
  'basketball_nba':            11,   // Basketball (was 2 — WRONG)
  'basketball_euroleague':     11,
  'baseball_mlb':              13,   // Baseball (was 3 — WRONG)
  'icehockey_nhl':             15,   // Ice Hockey (was 4 — WRONG)
  'tennis_atp_french_open':    12,   // Tennis (was 5 — WRONG)
  'tennis_wta_french_open':    12,
  'mma_mixed_martial_arts':    20,   // MMA (was 7 — WRONG)
};

// Cache for tournament IDs discovered from the API
const tournamentCache = new Map<number, number[]>();

// Market IDs: 101 = 1X2 (soccer), 111 = Moneyline (basketball/baseball/hockey)
function getMarketId(sportKey: string): string {
  if (sportKey.startsWith('soccer')) return '101';
  return '111'; // moneyline for everything else
}

function getOutcomeLabels(sportKey: string): Record<string, string> {
  if (sportKey.startsWith('soccer')) {
    return { '101': 'Home', '102': 'Draw', '103': 'Away' };
  }
  return { '111': 'Home', '112': 'Away' };
}

// ─── OddsPapi API calls ────────────────────────────────────────────────

const ODDSPAPI_BASE = 'https://api.oddspapi.io/v4';

// Step 1: Discover tournament IDs for a sport (cached, 1 request)
// Step 2: Get odds by tournament (1 request, ALL bookmakers)
async function discoverTournaments(sportId: number, apiKey: string): Promise<number[]> {
  const cached = tournamentCache.get(sportId);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${ODDSPAPI_BASE}/tournaments?sportId=${sportId}&apiKey=${apiKey}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    // Get tournaments with upcoming fixtures, sorted by most fixtures
    const active = items
      .filter((t: Record<string, unknown>) => 
        ((t.futureFixtures as number) || 0) > 0 || ((t.upcomingFixtures as number) || 0) > 0
      )
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
        ((b.upcomingFixtures as number) || 0) - ((a.upcomingFixtures as number) || 0)
      )
      .slice(0, 5) // Top 5 active tournaments
      .map((t: Record<string, unknown>) => t.tournamentId as number);
    
    if (active.length > 0) {
      tournamentCache.set(sportId, active);
    }
    return active;
  } catch {
    return [];
  }
}

async function fetchOddsPapiByTournament(
  sportKey: string,
  apiKey: string
): Promise<NormalizedOdds[]> {
  const sportId = ODDSPAPI_SPORT_IDS[sportKey];
  if (!sportId) return [];

  // Auto-discover tournament IDs
  const tournamentIds = await discoverTournaments(sportId, apiKey);
  if (tournamentIds.length === 0) return [];

  const marketId = getMarketId(sportKey);
  const outcomeLabels = getOutcomeLabels(sportKey);

  try {
    // This ONE request returns ALL fixtures with odds from ALL bookmakers
    // for the specified tournaments. Most efficient endpoint.
    const url = `${ODDSPAPI_BASE}/odds-by-tournaments?` + new URLSearchParams({
      apiKey,
      tournamentIds: tournamentIds.join(','),
      oddsFormat:    'decimal',
    });

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`OddsPapi odds-by-tournaments: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    const events: NormalizedOdds[] = [];

    for (const fixture of items) {
      if (!fixture.hasOdds) continue;

      const bookmakerOdds = fixture.bookmakerOdds || {};
      const ev: NormalizedOdds = {
        eventId:      fixture.fixtureId || `op_${Date.now()}`,
        sport:        sportKey,
        sportTitle:   fixture.sportName || sportKey,
        homeTeam:     fixture.participant1Name || '',
        awayTeam:     fixture.participant2Name || '',
        commenceTime: fixture.startTime || new Date().toISOString(),
        bookmakers:   [],
      };

      // Parse each bookmaker's odds
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
          const label = outcomeLabels[outcomeId] ||
                        (od.outcomeName as string) ||
                        (outcomeId === '101' || outcomeId === '111' ? ev.homeTeam :
                         outcomeId === '103' || outcomeId === '112' ? ev.awayTeam : 'Draw');

          if (price && price > 1.01) {
            outcomes.push({ name: label, price });
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
    }

    return events;
  } catch (err) {
    console.error('OddsPapi error:', err);
    return [];
  }
}

// ─── The Odds API (BACKUP — 35 credits left) ───────────────────────────

async function fetchTheOddsAPI(sportKey: string): Promise<{
  events: NormalizedOdds[];
  quotaUsed: number;
  quotaRemaining: number;
}> {
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

  const cached = getFromCache(cacheKey, ttl);
  if (cached) {
    debug.push(`Cache hit: ${cached.length} events`);
    return { events: cached, sources: ['cache'], quotaUsed: 0, quotaRemaining: 0, debug, cached: true };
  }

  let allEvents: NormalizedOdds[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;

  // Priority 1: OddsPapi (1 request = ALL bookmakers for ALL fixtures in tournament)
  const oddspapiKey = process.env.ODDSPAPI_API_KEY;
  if (oddspapiKey) {
    const events = await fetchOddsPapiByTournament(sportKey, oddspapiKey);
    if (events.length > 0) {
      allEvents.push(...events);
      sources.push('OddsPapi');
      const totalBooks = events.reduce((s, e) => s + e.bookmakers.length, 0);
      debug.push(`OddsPapi: ${events.length} fixtures, ${totalBooks} total bookmaker entries`);
    } else {
      debug.push('OddsPapi: no fixtures with odds for this sport');
    }
  } else {
    debug.push('OddsPapi: ODDSPAPI_API_KEY not set');
  }

  // Priority 2: The Odds API (only if OddsPapi returned nothing AND credits > 20)
  if (allEvents.length === 0) {
    const oddsApiKey = process.env.ODDS_API_KEY;
    if (oddsApiKey) {
      const result = await fetchTheOddsAPI(sportKey);
      quotaUsed = result.quotaUsed;
      quotaRemaining = result.quotaRemaining;

      if (quotaRemaining < 20) {
        debug.push(`The Odds API: PAUSED — only ${quotaRemaining} credits left (saving for emergencies)`);
      } else if (result.events.length > 0) {
        allEvents.push(...result.events);
        sources.push('The Odds API');
        debug.push(`The Odds API: ${result.events.length} events (${quotaRemaining} credits left)`);
      } else {
        debug.push(`The Odds API: no events (${quotaRemaining} credits left)`);
      }
    }
  }

  if (allEvents.length > 0) {
    setCache(cacheKey, allEvents, sources.join('+'));
  }

  debug.push(`Total: ${allEvents.length} events from ${sources.length} source(s)`);
  return { events: allEvents, sources, quotaUsed, quotaRemaining, debug, cached: false };
}
