/**
 * SureEdge AI — Multi-API Odds Engine v4
 * 
 * VERIFIED FREE TIERS (no credit card):
 * 1. odds-api.io   — 100 req/HOUR (resets hourly) = 2,400/day ✅
 * 2. SharpAPI      — 12 req/min, NO monthly cap = ~17,000/day ✅  
 * 3. OddsPapi      — 250 req/MONTH (exhausted, resets June 1) ⏳
 * 4. The Odds API  — 500 credits/MONTH (1 left, resets June 1) ⏳
 * 
 * Strategy: odds-api.io PRIMARY (hourly reset), SharpAPI SECONDARY
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

// ─── Cache (prevents duplicate calls within TTL) ─────────────────────────

const cache = new Map<string, { data: NormalizedOdds[]; ts: number }>();

function getCached(key: string, ttlMs: number): NormalizedOdds[] | null {
  const e = cache.get(key);
  if (!e || Date.now() - e.ts > ttlMs) { cache.delete(key); return null; }
  return e.data;
}

function setCache(key: string, data: NormalizedOdds[]) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 50) {
    const old = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 10; i++) cache.delete(old[i][0]);
  }
}

// ─── Sport key mappings ───────────────────────────────────────────────────

const ODDS_API_IO_SPORTS: Record<string, string> = {
  'basketball_nba':            'basketball_nba',
  'soccer_epl':                'soccer_epl',
  'soccer_spain_la_liga':      'soccer_spain_la_liga',
  'soccer_italy_serie_a':     'soccer_italy_serie_a',
  'soccer_germany_bundesliga': 'soccer_germany_bundesliga',
  'soccer_france_ligue_one':   'soccer_france_ligue_one',
  'soccer_uefa_champs_league': 'soccer_uefa_champs_league',
  'baseball_mlb':              'baseball_mlb',
  'icehockey_nhl':             'icehockey_nhl',
  'tennis_atp_french_open':   'tennis_atp_french_open',
  'mma_mixed_martial_arts':   'mma_mixed_martial_arts',
};

const SHARPAPI_SPORTS: Record<string, string> = {
  'basketball_nba':   'basketball/nba',
  'soccer_epl':       'soccer/epl',
  'baseball_mlb':     'baseball/mlb',
  'icehockey_nhl':    'hockey/nhl',
  'mma_mixed_martial_arts': 'mma',
};

// ─── API 1: odds-api.io (100 req/hr, resets hourly) ─────────────────────

async function fetchOddsApiIo(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDS_API_IO_KEY;
  if (!apiKey) { debug.push('odds-api.io: ODDS_API_IO_KEY not set'); return []; }

  const sport = ODDS_API_IO_SPORTS[sportKey];
  if (!sport) { debug.push(`odds-api.io: unknown sport ${sportKey}`); return []; }

  try {
    const url = `https://api.odds-api.io/v1/odds?` + new URLSearchParams({
      apiKey,
      sport,
      regions:    'uk,eu,us',
      markets:    'h2h',
      oddsFormat: 'decimal',
    });

    const res = await fetch(url, { cache: 'no-store' });

    if (res.status === 429) {
      debug.push('odds-api.io: rate limit — hourly quota used, resets next hour');
      return [];
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      debug.push(`odds-api.io: ${res.status} — ${body.slice(0, 150)}`);
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.data || data.events || []);

    const events: NormalizedOdds[] = items.map((item: Record<string, unknown>) => ({
      eventId:      String(item.id || item.event_id || `oio_${Date.now()}_${Math.random()}`),
      sport:        sportKey,
      sportTitle:   String(item.sport_title || item.sport || sportKey),
      homeTeam:     String(item.home_team || item.home || ''),
      awayTeam:     String(item.away_team || item.away || ''),
      commenceTime: String(item.commence_time || item.start_time || new Date().toISOString()),
      bookmakers:   ((item.bookmakers || []) as Record<string, unknown>[]).map((bm) => ({
        key:     String(bm.key || bm.id || '').toLowerCase(),
        title:   String(bm.title || bm.name || ''),
        market:  'h2h',
        outcomes: (((bm.markets as Record<string, unknown>[])?.[0]?.outcomes) as { name: string; price: number }[] || []).map((o) => ({
          name: o.name || '', price: o.price || 0,
        })),
      })).filter((bm: { outcomes: { name: string; price: number }[] }) => bm.outcomes.length >= 2),
    })).filter((e: NormalizedOdds) => e.homeTeam && e.bookmakers.length >= 2);

    debug.push(`odds-api.io: ${events.length} events, ${events.reduce((s, e) => s + e.bookmakers.length, 0)} bookmakers`);
    return events;
  } catch (err) {
    debug.push(`odds-api.io: error — ${err}`);
    return [];
  }
}

// ─── API 2: SharpAPI (12 req/min, no monthly cap) ────────────────────────

async function fetchSharpAPI(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.SHARP_API_KEY;
  if (!apiKey) { debug.push('SharpAPI: SHARP_API_KEY not set'); return []; }

  const sport = SHARPAPI_SPORTS[sportKey];
  if (!sport) { debug.push(`SharpAPI: no mapping for ${sportKey}`); return []; }

  try {
    // SharpAPI REST endpoint — returns moneyline odds
    const url = `https://sharpapi.io/api/v1/sport/${sport}/odds`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (res.status === 429) { debug.push('SharpAPI: rate limited (12/min) — try again'); return []; }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      debug.push(`SharpAPI: ${res.status} — ${body.slice(0, 150)}`);
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.data || data.games || data.events || []);

    const events: NormalizedOdds[] = [];
    for (const item of items) {
      const bookmakers: NormalizedOdds['bookmakers'] = [];
      const sportsbooks = item.sportsbooks || item.bookmakers || item.odds || [];

      for (const sb of (Array.isArray(sportsbooks) ? sportsbooks : [])) {
        const outcomes: { name: string; price: number }[] = [];
        // SharpAPI format varies — try multiple structures
        if (sb.moneyline) {
          if (sb.moneyline.home) outcomes.push({ name: item.home_team || 'Home', price: sb.moneyline.home });
          if (sb.moneyline.away) outcomes.push({ name: item.away_team || 'Away', price: sb.moneyline.away });
          if (sb.moneyline.draw) outcomes.push({ name: 'Draw', price: sb.moneyline.draw });
        } else if (sb.outcomes) {
          for (const o of (Array.isArray(sb.outcomes) ? sb.outcomes : [])) {
            if (o.name && o.price) outcomes.push({ name: o.name, price: o.price });
          }
        }
        if (outcomes.length >= 2) {
          bookmakers.push({
            key:   (sb.key || sb.id || sb.name || '').toLowerCase().replace(/\s+/g, ''),
            title: sb.title || sb.name || sb.key || '',
            market: 'h2h',
            outcomes,
          });
        }
      }

      if (bookmakers.length >= 2) {
        events.push({
          eventId:      String(item.id || item.event_id || `sharp_${Date.now()}`),
          sport:        sportKey,
          sportTitle:   String(item.sport_title || item.league || sportKey),
          homeTeam:     String(item.home_team || item.home || ''),
          awayTeam:     String(item.away_team || item.away || ''),
          commenceTime: String(item.commence_time || item.start_time || item.game_time || new Date().toISOString()),
          bookmakers,
        });
      }
    }

    debug.push(`SharpAPI: ${events.length} events, ${events.reduce((s, e) => s + e.bookmakers.length, 0)} bookmakers`);
    return events;
  } catch (err) {
    debug.push(`SharpAPI: error — ${err}`);
    return [];
  }
}

// ─── API 3: OddsPapi (250/month — backup when others fail) ──────────────

async function fetchOddsPapi(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDSPAPI_API_KEY;
  if (!apiKey) { debug.push('OddsPapi: not configured'); return []; }

  const SPORT_IDS: Record<string, number> = {
    'basketball_nba': 11, 'soccer_epl': 10, 'baseball_mlb': 13,
    'icehockey_nhl': 15, 'tennis_atp_french_open': 12, 'mma_mixed_martial_arts': 20,
  };
  const sportId = SPORT_IDS[sportKey];
  if (!sportId) return [];

  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const res = await fetch(`https://api.oddspapi.io/v4/fixtures?` + new URLSearchParams({
      apiKey, sportId: String(sportId), hasOdds: 'true',
      from: now.toISOString(), to: tomorrow.toISOString(),
    }), { cache: 'no-store' });

    if (!res.ok) { debug.push(`OddsPapi fixtures: ${res.status}`); return []; }
    const fixtures = (await res.json() as Record<string, unknown>[]).filter((f) => f.hasOdds);
    if (fixtures.length === 0) { debug.push('OddsPapi: no fixtures with odds'); return []; }

    const marketId = sportKey.startsWith('soccer') ? '101' : '111';
    const events: NormalizedOdds[] = [];

    for (const fixture of fixtures.slice(0, 3)) {
      const oddsRes = await fetch(`https://api.oddspapi.io/v4/odds?` + new URLSearchParams({
        apiKey, fixtureId: String(fixture.fixtureId), oddsFormat: 'decimal',
      }), { cache: 'no-store' });
      if (!oddsRes.ok) continue;

      const oddsData = await oddsRes.json() as Record<string, unknown>;
      const bookmakerOdds = oddsData.bookmakerOdds as Record<string, Record<string, unknown>> || {};
      const homeTeam = String(fixture.participant1Name || '');
      const awayTeam = String(fixture.participant2Name || '');
      const bookmakers: NormalizedOdds['bookmakers'] = [];

      for (const [slug, bmData] of Object.entries(bookmakerOdds)) {
        const markets = (bmData.markets as Record<string, Record<string, unknown>>);
        if (!markets?.[marketId]) continue;
        const outcomesObj = (markets[marketId] as Record<string, unknown>).outcomes as Record<string, Record<string, unknown>>;
        if (!outcomesObj) continue;
        const outcomes: { name: string; price: number }[] = [];
        for (const [oid, od] of Object.entries(outcomesObj)) {
          const price = ((od.players as Record<string, Record<string, unknown>>)?.['0']?.price as number);
          const name = marketId === '101'
            ? (oid === '101' ? homeTeam : oid === '102' ? 'Draw' : awayTeam)
            : (oid === '111' ? homeTeam : awayTeam);
          if (price && price > 1.01 && name) outcomes.push({ name, price });
        }
        if (outcomes.length >= 2) bookmakers.push({ key: slug.toLowerCase(), title: slug, market: 'h2h', outcomes });
      }

      if (bookmakers.length >= 2) {
        events.push({
          eventId: String(fixture.fixtureId), sport: sportKey,
          sportTitle: String(fixture.sportName || sportKey),
          homeTeam, awayTeam,
          commenceTime: String(fixture.startTime || new Date().toISOString()),
          bookmakers,
        });
      }
    }

    debug.push(`OddsPapi: ${events.length} events`);
    return events;
  } catch (err) {
    debug.push(`OddsPapi: error — ${err}`);
    return [];
  }
}

// ─── Smart Router ─────────────────────────────────────────────────────────

export interface ScanResult {
  events: NormalizedOdds[];
  sources: string[];
  debug: string[];
}

export async function smartScan(sportKey: string): Promise<ScanResult> {
  const cacheKey = `scan:${sportKey}`;
  const cached = getCached(cacheKey, 60_000); // 60s cache
  if (cached) return { events: cached, sources: ['cache'], debug: [`Cache hit: ${cached.length} events`] };

  const debug: string[] = [];
  const sources: string[] = [];
  let events: NormalizedOdds[] = [];

  // PRIMARY: odds-api.io (100/hour, resets every hour)
  const oioEvents = await fetchOddsApiIo(sportKey, debug);
  if (oioEvents.length > 0) {
    events = oioEvents;
    sources.push('odds-api.io');
  }

  // SECONDARY: SharpAPI (12/min, no monthly cap)
  if (events.length === 0) {
    const sharpEvents = await fetchSharpAPI(sportKey, debug);
    if (sharpEvents.length > 0) {
      events = sharpEvents;
      sources.push('SharpAPI');
    }
  }

  // TERTIARY: OddsPapi (250/month — conserve)
  if (events.length === 0) {
    const papiEvents = await fetchOddsPapi(sportKey, debug);
    if (papiEvents.length > 0) {
      events = papiEvents;
      sources.push('OddsPapi');
    }
  }

  if (events.length > 0) setCache(cacheKey, events);
  debug.push(`Total: ${events.length} events from ${sources.join(', ') || 'none'}`);
  return { events, sources, debug };
}
