/**
 * SureEdge AI — Multi-API Odds Engine
 * 
 * Combines multiple free odds APIs for maximum coverage:
 * - SharpAPI (primary):    17,280 req/day, 2 books, 60s delay, no credit card
 * - Odds-API.io (secondary): 100 req/hr (~2,400/day), multiple books
 * - The Odds API (backup):   500 credits/month, 4 regions, most books
 * 
 * Smart routing: use SharpAPI for frequent scans, The Odds API for deep comparisons
 */

// ─── Types ──────────────────────────────────────────────────────────────

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

interface CacheEntry {
  data: NormalizedOdds[];
  timestamp: number;
  source: string;
}

// ─── In-Memory Cache ────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();

function getCacheTTL(commenceTime?: string): number {
  if (!commenceTime) return 120_000; // 2 min default
  const msUntilStart = new Date(commenceTime).getTime() - Date.now();
  if (msUntilStart < 0)           return 15_000;   // Live: 15s
  if (msUntilStart < 3_600_000)   return 30_000;   // <1hr: 30s
  if (msUntilStart < 10_800_000)  return 120_000;  // <3hr: 2min
  return 300_000;                                    // >3hr: 5min
}

function getFromCache(key: string, ttl: number): NormalizedOdds[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NormalizedOdds[], source: string) {
  cache.set(key, { data, timestamp: Date.now(), source });
  // Evict old entries
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) cache.delete(oldest[i][0]);
  }
}

// ─── API 1: SharpAPI (Primary — 17,280 req/day free) ────────────────────

const SHARP_SPORT_MAP: Record<string, string> = {
  'soccer_epl':                'soccer',
  'soccer_spain_la_liga':      'soccer',
  'soccer_italy_serie_a':      'soccer',
  'soccer_germany_bundesliga': 'soccer',
  'soccer_france_ligue_one':   'soccer',
  'soccer_uefa_champs_league': 'soccer',
  'basketball_nba':            'basketball',
  'baseball_mlb':              'baseball',
  'icehockey_nhl':             'hockey',
  'mma_mixed_martial_arts':    'mma',
  'tennis_atp_french_open':    'tennis',
};

async function fetchSharpAPI(sportKey: string): Promise<NormalizedOdds[]> {
  const apiKey = process.env.SHARP_API_KEY;
  if (!apiKey) return [];

  const sharpSport = SHARP_SPORT_MAP[sportKey];
  if (!sharpSport) return [];

  try {
    const res = await fetch(`https://api.sharpapi.io/api/v1/odds?sport=${sharpSport}&market=moneyline`, {
      headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) return [];
    const data = await res.json();

    // Normalize SharpAPI response to common format
    const events: NormalizedOdds[] = [];
    const items = Array.isArray(data) ? data : (data.data || data.odds || []);

    for (const item of items) {
      const ev: NormalizedOdds = {
        eventId:      item.id || item.event_id || `sharp_${Date.now()}_${Math.random()}`,
        sport:        sportKey,
        sportTitle:   item.sport || sharpSport,
        homeTeam:     item.home_team || item.home || '',
        awayTeam:     item.away_team || item.away || '',
        commenceTime: item.commence_time || item.start_time || item.scheduled || new Date().toISOString(),
        bookmakers:   [],
      };

      // Extract bookmaker odds
      const books = item.bookmakers || item.sportsbooks || item.odds || [];
      for (const book of (Array.isArray(books) ? books : [])) {
        const outcomes = book.outcomes || book.markets?.[0]?.outcomes || [];
        ev.bookmakers.push({
          key:     (book.key || book.id || book.name || '').toLowerCase().replace(/\s+/g, ''),
          title:   book.title || book.name || book.key || 'Unknown',
          market:  'h2h',
          outcomes: outcomes.map((o: { name?: string; label?: string; price?: number; odds?: number }) => ({
            name:  o.name || o.label || '',
            price: o.price || o.odds || 0,
          })),
        });
      }

      if (ev.bookmakers.length >= 2 && ev.homeTeam) {
        events.push(ev);
      }
    }

    return events;
  } catch (err) {
    console.error('SharpAPI error:', err);
    return [];
  }
}

// ─── API 2: Odds-API.io (Secondary — 100 req/hr free) ──────────────────

async function fetchOddsAPIio(sportKey: string): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDS_API_IO_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(`https://api.odds-api.io/v1/odds?sport=${sportKey}&apiKey=${apiKey}`, {
      cache: 'no-store',
    });

    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.data || []);

    return items.map((item: Record<string, unknown>) => ({
      eventId:      String(item.id || `oio_${Date.now()}`),
      sport:        sportKey,
      sportTitle:   String(item.sport_title || item.sport || sportKey),
      homeTeam:     String(item.home_team || item.home || ''),
      awayTeam:     String(item.away_team || item.away || ''),
      commenceTime: String(item.commence_time || item.start_time || new Date().toISOString()),
      bookmakers:   ((item.bookmakers || []) as Record<string, unknown>[]).map((bm) => ({
        key:     String(bm.key || bm.id || '').toLowerCase(),
        title:   String(bm.title || bm.name || ''),
        market:  'h2h',
        outcomes: ((bm.markets as Record<string, unknown>[])?.[0]?.outcomes as { name: string; price: number }[] || []).map((o) => ({
          name: o.name || '', price: o.price || 0,
        })),
      })),
    })).filter((e: NormalizedOdds) => e.bookmakers.length >= 2);
  } catch (err) {
    console.error('Odds-API.io error:', err);
    return [];
  }
}

// ─── API 3: The Odds API (Backup — 500 credits/month) ──────────────────

async function fetchTheOddsAPI(sportKey: string): Promise<{ events: NormalizedOdds[]; quotaUsed: number; quotaRemaining: number }> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { events: [], quotaUsed: 0, quotaRemaining: 0 };

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'us,uk,eu,au',
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

  // Check cache first
  const cached = getFromCache(cacheKey, ttl);
  if (cached) {
    debug.push(`Cache hit: ${cached.length} events (TTL ${ttl / 1000}s)`);
    return { events: cached, sources: ['cache'], quotaUsed: 0, quotaRemaining: 0, debug, cached: true };
  }

  let allEvents: NormalizedOdds[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;

  // Priority 1: SharpAPI (free, 17,280 req/day)
  const sharpEvents = await fetchSharpAPI(sportKey);
  if (sharpEvents.length > 0) {
    allEvents.push(...sharpEvents);
    sources.push('SharpAPI');
    debug.push(`SharpAPI: ${sharpEvents.length} events`);
  } else {
    debug.push('SharpAPI: no results or not configured');
  }

  // Priority 2: Odds-API.io (free, 100 req/hr)
  const oioEvents = await fetchOddsAPIio(sportKey);
  if (oioEvents.length > 0) {
    // Merge — deduplicate by matching home+away team names
    const existing = new Set(allEvents.map(e => `${e.homeTeam}|${e.awayTeam}`.toLowerCase()));
    for (const ev of oioEvents) {
      const key = `${ev.homeTeam}|${ev.awayTeam}`.toLowerCase();
      if (!existing.has(key)) {
        allEvents.push(ev);
        existing.add(key);
      } else {
        // Merge bookmakers from this source into existing event
        const match = allEvents.find(e => `${e.homeTeam}|${e.awayTeam}`.toLowerCase() === key);
        if (match) {
          const existingKeys = new Set(match.bookmakers.map(b => b.key));
          for (const bm of ev.bookmakers) {
            if (!existingKeys.has(bm.key)) {
              match.bookmakers.push(bm);
            }
          }
        }
      }
    }
    sources.push('Odds-API.io');
    debug.push(`Odds-API.io: ${oioEvents.length} events`);
  } else {
    debug.push('Odds-API.io: no results or not configured');
  }

  // Priority 3: The Odds API (500 credits/month — use sparingly)
  // Only use if other APIs returned nothing OR user has plenty of credits
  const oddsApiKey = process.env.ODDS_API_KEY;
  if (oddsApiKey && allEvents.length === 0) {
    const oddsResult = await fetchTheOddsAPI(sportKey);
    quotaUsed = oddsResult.quotaUsed;
    quotaRemaining = oddsResult.quotaRemaining;
    if (oddsResult.events.length > 0) {
      allEvents.push(...oddsResult.events);
      sources.push('The Odds API');
      debug.push(`The Odds API: ${oddsResult.events.length} events (${quotaRemaining} credits left)`);
    } else {
      debug.push(`The Odds API: no events (${quotaRemaining} credits left)`);
    }
  } else if (oddsApiKey && allEvents.length > 0) {
    // Merge The Odds API data for more bookmakers (richer arb detection)
    const oddsResult = await fetchTheOddsAPI(sportKey);
    quotaUsed = oddsResult.quotaUsed;
    quotaRemaining = oddsResult.quotaRemaining;
    if (oddsResult.events.length > 0) {
      const existing = new Set(allEvents.map(e => `${e.homeTeam}|${e.awayTeam}`.toLowerCase()));
      for (const ev of oddsResult.events) {
        const key = `${ev.homeTeam}|${ev.awayTeam}`.toLowerCase();
        if (!existing.has(key)) {
          allEvents.push(ev);
        } else {
          const match = allEvents.find(e => `${e.homeTeam}|${e.awayTeam}`.toLowerCase() === key);
          if (match) {
            const existingKeys = new Set(match.bookmakers.map(b => b.key));
            for (const bm of ev.bookmakers) {
              if (!existingKeys.has(bm.key)) match.bookmakers.push(bm);
            }
          }
        }
      }
      sources.push('The Odds API');
      debug.push(`The Odds API (merged): +${oddsResult.events.length} events (${quotaRemaining} credits left)`);
    }
  } else {
    debug.push('The Odds API: not configured');
  }

  // Cache the merged results
  if (allEvents.length > 0) {
    setCache(cacheKey, allEvents, sources.join('+'));
  }

  debug.push(`Total: ${allEvents.length} events from ${sources.length} source(s)`);

  return { events: allEvents, sources, quotaUsed, quotaRemaining, debug, cached: false };
}
