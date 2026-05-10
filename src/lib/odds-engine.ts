/**
 * SureEdge AI — Multi-API Odds Engine v5
 *
 * APIs ranked by coverage of Pinnacle, 1xBet, Betfair, Bet365:
 *
 * 1. OddsPapi      250/month  — ALL 4 books ✅  best coverage  (resets June 1)
 * 2. odds-api.io   100/hour   — Bet365+others   (testing Pinnacle coverage)
 * 3. The Odds API  500/month  — Betfair+Bet365  no Pinnacle/1xBet (resets June 1)
 *
 * Removed: SharpAPI (US-only, 2 books free), SHARP_API_KEY was wrong anyway
 *
 * No hardcoded bookmaker filters — all bookmakers returned by API are compared.
 * Bookmaker metadata (name, URL, access) loaded dynamically from normalizer.
 */

export interface NormalizedOdds {
  eventId:      string;
  sport:        string;
  sportTitle:   string;
  homeTeam:     string;
  awayTeam:     string;
  commenceTime: string;
  bookmakers: {
    key:      string;
    title:    string;
    market:   string;
    outcomes: { name: string; price: number }[];
  }[];
}

export interface ScanResult {
  events:  NormalizedOdds[];
  sources: string[];
  debug:   string[];
}

// ─── 60-second cache ─────────────────────────────────────────────────────

const cache = new Map<string, { data: NormalizedOdds[]; ts: number }>();

function getCached(key: string): NormalizedOdds[] | null {
  const e = cache.get(key);
  if (!e || Date.now() - e.ts > 60_000) { cache.delete(key); return null; }
  return e.data;
}

function setCache(key: string, data: NormalizedOdds[]) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 100) {
    const old = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    old.slice(0, 20).forEach(([k]) => cache.delete(k));
  }
}

// ─── Sport key → API-specific mappings ───────────────────────────────────

// OddsPapi verified sport IDs from /v4/sports
const ODDSPAPI_SPORT_IDS: Record<string, number> = {
  soccer:                      10,
  'soccer_epl':                10,
  'soccer_spain_la_liga':      10,
  'soccer_italy_serie_a':      10,
  'soccer_germany_bundesliga': 10,
  'soccer_france_ligue_one':   10,
  'soccer_uefa_champs_league': 10,
  'basketball_nba':            11,
  'baseball_mlb':              13,
  'icehockey_nhl':             15,
  'tennis_atp_french_open':    12,
  'tennis_wta_french_open':    12,
  'mma_mixed_martial_arts':    20,
};

// The Odds API sport keys (same format we already use)
const THEODDSAPI_SPORTS = new Set([
  'soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a',
  'soccer_germany_bundesliga', 'soccer_france_ligue_one', 'soccer_uefa_champs_league',
  'basketball_nba', 'baseball_mlb', 'icehockey_nhl',
  'tennis_atp_french_open', 'mma_mixed_martial_arts',
]);

// ─── OddsPapi (PRIMARY when available — 350+ bookmakers incl Pinnacle/1xBet/Betfair/Bet365) ──

async function fetchOddsPapi(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDSPAPI_API_KEY;
  if (!apiKey) { debug.push('OddsPapi: key not set'); return []; }

  const sportId = ODDSPAPI_SPORT_IDS[sportKey] ?? ODDSPAPI_SPORT_IDS['soccer'];
  const marketId = sportKey.startsWith('soccer') ? '101' : '111';

  try {
    // Get fixtures with odds in next 24 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

    const fixturesRes = await fetch(
      `https://api.oddspapi.io/v4/fixtures?` + new URLSearchParams({
        apiKey, sportId: String(sportId), hasOdds: 'true',
        from: now.toISOString(), to: tomorrow.toISOString(),
      }),
      { cache: 'no-store' }
    );

    if (!fixturesRes.ok) {
      const body = await fixturesRes.text().catch(() => '');
      debug.push(`OddsPapi fixtures: ${fixturesRes.status} — ${body.slice(0, 150)}`);
      return [];
    }

    const fixtures = (await fixturesRes.json() as Record<string, unknown>[])
      .filter(f => f.hasOdds);

    if (fixtures.length === 0) { debug.push('OddsPapi: no fixtures with odds today'); return []; }
    debug.push(`OddsPapi: ${fixtures.length} fixtures`);

    const events: NormalizedOdds[] = [];

    // Get odds for top 5 fixtures — each returns ALL 350+ bookmakers
    for (const fixture of fixtures.slice(0, 5)) {
      const fixtureId = String(fixture.fixtureId ?? '');
      if (!fixtureId) continue;

      const oddsRes = await fetch(
        `https://api.oddspapi.io/v4/odds?` + new URLSearchParams({
          apiKey, fixtureId, oddsFormat: 'decimal',
        }),
        { cache: 'no-store' }
      );

      if (!oddsRes.ok) { debug.push(`OddsPapi odds ${fixtureId}: ${oddsRes.status}`); continue; }

      const oddsData  = await oddsRes.json() as Record<string, unknown>;
      const bmOdds    = (oddsData.bookmakerOdds ?? {}) as Record<string, Record<string, unknown>>;
      const homeTeam  = String(fixture.participant1Name ?? '');
      const awayTeam  = String(fixture.participant2Name ?? '');
      const bookmakers: NormalizedOdds['bookmakers'] = [];

      for (const [slug, bmData] of Object.entries(bmOdds)) {
        const markets = bmData.markets as Record<string, Record<string, unknown>> | undefined;
        if (!markets?.[marketId]) continue;

        const outcomesObj = (markets[marketId] as Record<string, unknown>).outcomes as
          Record<string, Record<string, unknown>> | undefined;
        if (!outcomesObj) continue;

        const outcomes: { name: string; price: number }[] = [];
        for (const [oid, od] of Object.entries(outcomesObj)) {
          const players = (od.players ?? {}) as Record<string, Record<string, unknown>>;
          const price   = players['0']?.price as number | undefined;
          // Outcome label from the API (outcomeName) or derive from ID
          let name = String((od as Record<string, unknown>).outcomeName ?? '');
          if (!name) {
            if (marketId === '101') {
              name = oid === '101' ? homeTeam : oid === '102' ? 'Draw' : awayTeam;
            } else {
              name = oid === '111' ? homeTeam : oid === '112' ? awayTeam : '';
            }
          }
          if (price && price > 1.01 && price < 100 && name) {
            outcomes.push({ name, price });
          }
        }

        if (outcomes.length >= 2) {
          bookmakers.push({ key: slug.toLowerCase(), title: slug, market: 'h2h', outcomes });
        }
      }

      if (bookmakers.length >= 2 && homeTeam) {
        events.push({
          eventId:      fixtureId,
          sport:        sportKey,
          sportTitle:   String(fixture.sportName ?? sportKey),
          homeTeam,
          awayTeam,
          commenceTime: String(fixture.startTime ?? new Date().toISOString()),
          bookmakers,
        });
        debug.push(`  ${homeTeam} vs ${awayTeam}: ${bookmakers.length} books`);
      }
    }

    return events;
  } catch (err) {
    debug.push(`OddsPapi: error — ${err}`);
    return [];
  }
}

// ─── odds-api.io (SECONDARY — 265+ bookmakers, 100 req/hour) ─────────────

async function fetchOddsApiIo(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDS_API_IO_KEY;
  if (!apiKey) { debug.push('odds-api.io: key not set'); return []; }

  try {
    // Map our sport key to odds-api.io sport slug
    const sportSlug = sportKey.includes('soccer') ? 'football'
      : sportKey.includes('basketball') ? 'basketball'
      : sportKey.includes('baseball') ? 'baseball'
      : sportKey.includes('hockey') ? 'ice-hockey'
      : sportKey.includes('tennis') ? 'tennis'
      : sportKey.includes('mma') ? 'mma'
      : 'football';

    // Step 1: Get events
    const evRes = await fetch(
      `https://api.odds-api.io/v3/events?` + new URLSearchParams({
        apiKey, sport: sportSlug, limit: '10',
      }),
      { cache: 'no-store' }
    );

    if (evRes.status === 429) { debug.push('odds-api.io: rate limit (100/hr)'); return []; }
    if (!evRes.ok) {
      const body = await evRes.text().catch(() => '');
      debug.push(`odds-api.io events: ${evRes.status} — ${body.slice(0, 150)}`);
      return [];
    }

    const evData  = await evRes.json() as Record<string, unknown>;
    const evItems = (Array.isArray(evData) ? evData : (evData.data ?? evData.events ?? [])) as
      Record<string, unknown>[];

    debug.push(`odds-api.io: ${evItems.length} events`);
    if (evItems.length === 0) return [];

    const events: NormalizedOdds[] = [];

    for (const ev of evItems.slice(0, 3)) {
      const eventId  = String(ev.id ?? ev.eventId ?? '');
      if (!eventId) continue;

      // Step 2: Get odds for this event
      const oddsRes = await fetch(
        `https://api.odds-api.io/v3/odds?` + new URLSearchParams({
          apiKey, eventId, market: 'moneyline',
        }),
        { cache: 'no-store' }
      );

      if (!oddsRes.ok) { debug.push(`odds-api.io odds ${eventId}: ${oddsRes.status}`); continue; }

      const oddsData   = await oddsRes.json() as Record<string, unknown>;
      const oddsItems  = (Array.isArray(oddsData) ? oddsData : (oddsData.data ?? oddsData.odds ?? [])) as
        Record<string, unknown>[];

      // Group odds by bookmaker
      const bmMap: Record<string, { title: string; outcomes: { name: string; price: number }[] }> = {};
      for (const o of oddsItems) {
        const bmRaw   = String(o.bookmaker ?? o.sportsbook ?? '');
        const bmKey   = bmRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!bmKey) continue;
        if (!bmMap[bmKey]) bmMap[bmKey] = { title: bmRaw, outcomes: [] };
        const outcome = String(o.outcome ?? o.selection ?? '');
        const price   = Number(o.odds ?? o.price ?? 0);
        if (outcome && price > 1.01 && price < 100) {
          bmMap[bmKey].outcomes.push({ name: outcome, price });
        }
      }

      const bookmakers = Object.entries(bmMap)
        .filter(([, bm]) => bm.outcomes.length >= 2)
        .map(([key, bm]) => ({ key, title: bm.title, market: 'h2h', outcomes: bm.outcomes }));

      const homeTeam = String(ev.homeTeam ?? ev.home_team ?? ev.home ?? '');
      const awayTeam = String(ev.awayTeam ?? ev.away_team ?? ev.away ?? '');

      if (bookmakers.length >= 2 && homeTeam) {
        events.push({
          eventId,
          sport:        sportKey,
          sportTitle:   String(ev.sport ?? ev.league ?? sportKey),
          homeTeam,
          awayTeam,
          commenceTime: String(ev.startTime ?? ev.commence_time ?? ev.start_time ?? new Date().toISOString()),
          bookmakers,
        });
        debug.push(`  ${homeTeam} vs ${awayTeam}: ${bookmakers.length} books`);
      }
    }

    return events;
  } catch (err) {
    debug.push(`odds-api.io: error — ${err}`);
    return [];
  }
}

// ─── The Odds API (TERTIARY — Betfair+Bet365, 500/month, resets June 1) ──

async function fetchTheOddsAPI(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey || !THEODDSAPI_SPORTS.has(sportKey)) return [];

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?` + new URLSearchParams({
        apiKey, regions: 'us,uk,eu,au', markets: 'h2h',
        oddsFormat: 'decimal', dateFormat: 'iso',
      }),
      { cache: 'no-store' }
    );

    const remaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);
    if (remaining < 5) { debug.push(`The Odds API: paused — ${remaining} credits left`); return []; }
    if (!res.ok) { debug.push(`The Odds API: ${res.status}`); return []; }

    const data = await res.json() as Record<string, unknown>[];
    debug.push(`The Odds API: ${data.length} events (${remaining} credits left)`);

    return data.map(item => ({
      eventId:      String(item.id),
      sport:        sportKey,
      sportTitle:   String(item.sport_title),
      homeTeam:     String(item.home_team),
      awayTeam:     String(item.away_team),
      commenceTime: String(item.commence_time),
      bookmakers:   ((item.bookmakers ?? []) as Record<string, unknown>[]).map(bm => ({
        key:     String(bm.key ?? '').toLowerCase(),
        title:   String(bm.title ?? ''),
        market:  'h2h',
        outcomes: (((bm.markets as Record<string, unknown>[])?.[0]?.outcomes) as
          { name: string; price: number }[] ?? []).map(o => ({ name: o.name, price: o.price })),
      })).filter(bm => bm.outcomes.length >= 2),
    })).filter(e => e.bookmakers.length >= 2);
  } catch (err) {
    debug.push(`The Odds API: error — ${err}`);
    return [];
  }
}

// ─── Smart Router ─────────────────────────────────────────────────────────

export async function smartScan(sportKey: string): Promise<ScanResult> {
  // Return cache if fresh
  const cacheKey = `scan:${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return { events: cached, sources: ['cache'], debug: [`Cache: ${cached.length} events`] };

  const debug: string[] = [];
  const sources: string[] = [];
  let events: NormalizedOdds[] = [];

  // 1. OddsPapi — 350+ bookmakers, Pinnacle+1xBet+Betfair+Bet365
  const papiEvents = await fetchOddsPapi(sportKey, debug);
  if (papiEvents.length > 0) { events = papiEvents; sources.push('OddsPapi'); }

  // 2. odds-api.io — 265+ bookmakers, hourly reset
  if (events.length === 0) {
    const oioEvents = await fetchOddsApiIo(sportKey, debug);
    if (oioEvents.length > 0) { events = oioEvents; sources.push('odds-api.io'); }
  }

  // 3. The Odds API — Betfair+Bet365 but no Pinnacle/1xBet
  if (events.length === 0) {
    const todaEvents = await fetchTheOddsAPI(sportKey, debug);
    if (todaEvents.length > 0) { events = todaEvents; sources.push('The Odds API'); }
  }

  debug.push(`Total: ${events.length} events from [${sources.join(', ') || 'none'}]`);
  if (events.length > 0) setCache(cacheKey, events);
  return { events, sources, debug };
}
