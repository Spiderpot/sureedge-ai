/**
 * SureEdge AI — Multi-API Odds Engine v6
 *
 * ACTIVE HYBRID STACK (no waiting):
 *
 * 1. Pinnacle Direct API  — FREE, unlimited, your own Pinnacle account
 *    Coverage: Pinnacle only (the sharp benchmark)
 *    Auth: Basic auth with Pinnacle username:password
 *    Limit: Rate limited, not credit-based
 *
 * 2. odds-api.io          — 100 req/HOUR (hourly reset, effectively unlimited)
 *    Coverage: 241 bookmakers incl 1xBet ✅ 22Bet ✅ Betfair ✅ Bet365 ✅ Bet9ja ✅
 *    No Pinnacle — use #1 for Pinnacle
 *
 * 3. OddsPapi             — 250/month (resets June 1, then primary)
 *    Coverage: ALL 350+ incl Pinnacle+1xBet+Betfair+Bet365
 *
 * 4. The Odds API         — 500/month (resets June 1)
 *    Coverage: Betfair+Bet365, no Pinnacle
 *
 * ARBS WE CAN FIND NOW:
 * - Pinnacle (direct) vs 1xBet (odds-api.io)   → best arbs 2-8%
 * - Pinnacle (direct) vs Betfair (odds-api.io) → exchange arbs
 * - 1xBet vs Betfair (odds-api.io)             → soft vs exchange
 * - Bet365 vs Betfair (odds-api.io)             → classic arbs
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

// ─── Cache ────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: NormalizedOdds[]; ts: number }>();
function getCached(key: string): NormalizedOdds[] | null {
  const e = cache.get(key);
  if (!e || Date.now() - e.ts > 60_000) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key: string, data: NormalizedOdds[]) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 100) {
    [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 20).forEach(([k]) => cache.delete(k));
  }
}

// ─── Pinnacle Sport IDs (from Pinnacle API docs) ──────────────────────────

const PINNACLE_SPORT_IDS: Record<string, number> = {
  'soccer_epl': 29,                // Soccer
  'soccer_spain_la_liga': 29,
  'soccer_italy_serie_a': 29,
  'soccer_germany_bundesliga': 29,
  'soccer_france_ligue_one': 29,
  'soccer_uefa_champs_league': 29,
  'basketball_nba': 4,             // Basketball
  'baseball_mlb': 3,               // Baseball
  'icehockey_nhl': 19,             // Ice Hockey
  'tennis_atp_french_open': 33,    // Tennis
  'tennis_wta_french_open': 33,
  'mma_mixed_martial_arts': 7,     // Mixed Martial Arts
};

// ─── odds-api.io Sport Slugs ──────────────────────────────────────────────

const OIO_SPORT_SLUGS: Record<string, string> = {
  'soccer_epl': 'football',
  'soccer_spain_la_liga': 'football',
  'soccer_italy_serie_a': 'football',
  'soccer_germany_bundesliga': 'football',
  'soccer_france_ligue_one': 'football',
  'soccer_uefa_champs_league': 'football',
  'basketball_nba': 'basketball',
  'baseball_mlb': 'baseball',
  'icehockey_nhl': 'ice-hockey',
  'tennis_atp_french_open': 'tennis',
  'tennis_wta_french_open': 'tennis',
  'mma_mixed_martial_arts': 'mma',
};

// Bookmakers to request from odds-api.io
const OIO_BOOKMAKERS = [
  '1xbet', '22Bet', 'Bet365', 'Betfair Exchange', 'Betfair Sportsbook',
  'Betway', 'Bet9ja', 'SportyBet', 'MelBet', 'BetWinner',
  'SingBet', 'Unibet', 'William Hill', 'NetBet', 'Tipico DE',
  'Bwin ES', 'Bwin FR', 'Bodog', 'BetOnline.ag', 'LowVig AG', 'MegaPari',
].join(',');

// ─── API 1: Pinnacle Direct (FREE — your funded account) ─────────────────

async function fetchPinnacle(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const username = process.env.PINNACLE_USERNAME;
  const password = process.env.PINNACLE_PASSWORD;
  if (!username || !password) { debug.push('Pinnacle: PINNACLE_USERNAME/PASSWORD not set'); return []; }

  const sportId = PINNACLE_SPORT_IDS[sportKey];
  if (!sportId) { debug.push(`Pinnacle: no sport ID for ${sportKey}`); return []; }

  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Get fixtures (leagues + events)
    const fixturesRes = await fetch(
      `https://api.pinnacle.com/v1/fixtures?sportId=${sportId}&leagueIds=&isLive=0`,
      { headers, cache: 'no-store' }
    );

    if (fixturesRes.status === 401) { debug.push('Pinnacle: auth failed — check PINNACLE_USERNAME/PASSWORD'); return []; }
    if (!fixturesRes.ok) { debug.push(`Pinnacle fixtures: ${fixturesRes.status}`); return []; }

    const fixturesData = await fixturesRes.json() as { league: { id: number; events: { id: number; home: string; away: string; starts: string }[] }[] };
    const allEvents: { id: number; home: string; away: string; starts: string; leagueId: number }[] = [];

    for (const league of (fixturesData.league ?? [])) {
      for (const ev of (league.events ?? [])) {
        if (ev.home && ev.away) {
          allEvents.push({ ...ev, leagueId: league.id });
        }
      }
    }

    if (allEvents.length === 0) { debug.push('Pinnacle: no fixtures'); return []; }
    debug.push(`Pinnacle: ${allEvents.length} fixtures`);

    // Get odds for all events
    const eventIds = allEvents.slice(0, 20).map(e => e.id).join(',');
    const oddsRes = await fetch(
      `https://api.pinnacle.com/v1/odds?sportId=${sportId}&leagueIds=&eventIds=${eventIds}&oddsFormat=Decimal&isLive=0`,
      { headers, cache: 'no-store' }
    );

    if (!oddsRes.ok) { debug.push(`Pinnacle odds: ${oddsRes.status}`); return []; }

    const oddsData = await oddsRes.json() as {
      leagues: { id: number; events: { id: number; periods: { number: number; moneyline: { home: number; draw?: number; away: number } | null }[] }[] }[]
    };

    const oddsMap: Record<number, { home: number; draw?: number; away: number }> = {};
    for (const league of (oddsData.leagues ?? [])) {
      for (const ev of (league.events ?? [])) {
        const fullGame = ev.periods?.find(p => p.number === 0);
        if (fullGame?.moneyline) {
          oddsMap[ev.id] = fullGame.moneyline;
        }
      }
    }

    const events: NormalizedOdds[] = [];
    for (const ev of allEvents.slice(0, 20)) {
      const odds = oddsMap[ev.id];
      if (!odds) continue;

      const outcomes: { name: string; price: number }[] = [
        { name: ev.home, price: odds.home },
        { name: ev.away, price: odds.away },
      ];
      if (odds.draw) outcomes.push({ name: 'Draw', price: odds.draw });

      events.push({
        eventId:      String(ev.id),
        sport:        sportKey,
        sportTitle:   sportKey,
        homeTeam:     ev.home,
        awayTeam:     ev.away,
        commenceTime: ev.starts,
        bookmakers: [{
          key: 'pinnacle', title: 'Pinnacle', market: 'h2h', outcomes,
        }],
      });
    }

    debug.push(`Pinnacle: ${events.length} events with odds`);
    return events;
  } catch (err) {
    debug.push(`Pinnacle: error — ${err}`);
    return [];
  }
}

// ─── API 2: odds-api.io (241 bookmakers, 100/hr hourly reset) ────────────

async function fetchOddsApiIo(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDS_API_IO_KEY;
  if (!apiKey) { debug.push('odds-api.io: key not set'); return []; }

  const sportSlug = OIO_SPORT_SLUGS[sportKey];
  if (!sportSlug) { debug.push(`odds-api.io: no slug for ${sportKey}`); return []; }

  try {
    const evRes = await fetch(
      `https://api.odds-api.io/v3/events?` + new URLSearchParams({ apiKey, sport: sportSlug, status: 'upcoming', limit: '10' }),
      { cache: 'no-store' }
    );

    if (evRes.status === 429) { debug.push('odds-api.io: rate limited (100/hr)'); return []; }
    if (!evRes.ok) {
      const b = await evRes.text().catch(() => '');
      debug.push(`odds-api.io events: ${evRes.status} — ${b.slice(0, 100)}`);
      return [];
    }

    const evItems = (await evRes.json() as Record<string, unknown>[]);
    if (!Array.isArray(evItems) || evItems.length === 0) { debug.push('odds-api.io: no events'); return []; }
    debug.push(`odds-api.io: ${evItems.length} events`);

    const events: NormalizedOdds[] = [];

    for (const ev of evItems.slice(0, 5)) {
      const item      = ev as Record<string, unknown>;
      const eventId   = String(item.id ?? '');
      const homeTeam  = String(item.home ?? '');
      const awayTeam  = String(item.away ?? '');
      if (!eventId || !homeTeam) continue;

      const oddsRes = await fetch(
        `https://api.odds-api.io/v3/odds?` + new URLSearchParams({ apiKey, eventId, market: 'moneyline', bookmakers: OIO_BOOKMAKERS }),
        { cache: 'no-store' }
      );

      if (!oddsRes.ok) { debug.push(`odds-api.io odds ${eventId}: ${oddsRes.status}`); continue; }

      const oddsItems = await oddsRes.json() as Record<string, unknown>[];
      if (!Array.isArray(oddsItems)) continue;

      // Group by bookmaker
      const bmMap: Record<string, { title: string; outcomes: { name: string; price: number }[] }> = {};
      for (const o of oddsItems) {
        const bmName  = String(o.bookmaker ?? o.sportsbook ?? '');
        const bmKey   = bmName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!bmKey) continue;
        if (!bmMap[bmKey]) bmMap[bmKey] = { title: bmName, outcomes: [] };
        const outcome = String(o.outcome ?? o.selection ?? '');
        const price   = Number(o.odds ?? o.price ?? 0);
        if (outcome && price > 1.01 && price < 100) {
          bmMap[bmKey].outcomes.push({ name: outcome, price });
        }
      }

      const bookmakers = Object.entries(bmMap)
        .filter(([, bm]) => bm.outcomes.length >= 2)
        .map(([key, bm]) => ({ key, title: bm.title, market: 'h2h', outcomes: bm.outcomes }));

      if (bookmakers.length >= 2) {
        const league = (item.league as Record<string, unknown>)?.name ?? sportKey;
        events.push({
          eventId, sport: sportKey, sportTitle: String(league),
          homeTeam, awayTeam,
          commenceTime: String(item.date ?? item.commence_time ?? new Date().toISOString()),
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

// ─── API 3: OddsPapi (250/month — becomes primary June 1) ────────────────

async function fetchOddsPapi(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDSPAPI_API_KEY;
  if (!apiKey) return [];

  const SPORT_IDS: Record<string, number> = {
    'basketball_nba': 11, 'soccer_epl': 10, 'baseball_mlb': 13,
    'icehockey_nhl': 15, 'tennis_atp_french_open': 12, 'mma_mixed_martial_arts': 20,
  };
  const sportId = SPORT_IDS[sportKey];
  if (!sportId) return [];

  try {
    const now      = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const res      = await fetch(
      `https://api.oddspapi.io/v4/fixtures?` + new URLSearchParams({
        apiKey, sportId: String(sportId), hasOdds: 'true',
        from: now.toISOString(), to: tomorrow.toISOString(),
      }),
      { cache: 'no-store' }
    );

    if (!res.ok) { debug.push(`OddsPapi: ${res.status}`); return []; }
    const fixtures = (await res.json() as Record<string, unknown>[]).filter(f => f.hasOdds);
    if (fixtures.length === 0) { debug.push('OddsPapi: no fixtures'); return []; }

    const marketId = sportKey.startsWith('soccer') ? '101' : '111';
    const events: NormalizedOdds[] = [];

    for (const fixture of fixtures.slice(0, 3)) {
      const fixtureId = String(fixture.fixtureId ?? '');
      if (!fixtureId) continue;

      const oddsRes = await fetch(
        `https://api.oddspapi.io/v4/odds?` + new URLSearchParams({ apiKey, fixtureId, oddsFormat: 'decimal' }),
        { cache: 'no-store' }
      );
      if (!oddsRes.ok) continue;

      const oddsData    = await oddsRes.json() as Record<string, unknown>;
      const bmOdds      = (oddsData.bookmakerOdds ?? {}) as Record<string, Record<string, unknown>>;
      const homeTeam    = String(fixture.participant1Name ?? '');
      const awayTeam    = String(fixture.participant2Name ?? '');
      const bookmakers: NormalizedOdds['bookmakers'] = [];

      for (const [slug, bmData] of Object.entries(bmOdds)) {
        const markets     = bmData.markets as Record<string, Record<string, unknown>> | undefined;
        if (!markets?.[marketId]) continue;
        const outcomesObj = (markets[marketId] as Record<string, unknown>).outcomes as Record<string, Record<string, unknown>> | undefined;
        if (!outcomesObj) continue;

        const outcomes: { name: string; price: number }[] = [];
        for (const [oid, od] of Object.entries(outcomesObj)) {
          const price = ((od.players as Record<string, Record<string, unknown>>)?.['0']?.price as number);
          const name  = marketId === '101'
            ? (oid === '101' ? homeTeam : oid === '102' ? 'Draw' : awayTeam)
            : (oid === '111' ? homeTeam : awayTeam);
          if (price && price > 1.01 && price < 100 && name) outcomes.push({ name, price });
        }
        if (outcomes.length >= 2) bookmakers.push({ key: slug.toLowerCase(), title: slug, market: 'h2h', outcomes });
      }

      if (bookmakers.length >= 2 && homeTeam) {
        events.push({
          eventId: fixtureId, sport: sportKey, sportTitle: String(fixture.sportName ?? sportKey),
          homeTeam, awayTeam, commenceTime: String(fixture.startTime ?? new Date().toISOString()), bookmakers,
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

// ─── API 4: The Odds API (backup, resets June 1) ─────────────────────────

async function fetchTheOddsAPI(sportKey: string, debug: string[]): Promise<NormalizedOdds[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?` + new URLSearchParams({
        apiKey, regions: 'us,uk,eu,au', markets: 'h2h', oddsFormat: 'decimal', dateFormat: 'iso',
      }),
      { cache: 'no-store' }
    );
    const remaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);
    if (remaining < 5) { debug.push(`The Odds API: paused (${remaining} left)`); return []; }
    if (!res.ok) return [];

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
        key:      String(bm.key ?? '').toLowerCase(),
        title:    String(bm.title ?? ''),
        market:   'h2h',
        outcomes: (((bm.markets as Record<string, unknown>[])?.[0]?.outcomes) as { name: string; price: number }[] ?? []).map(o => ({ name: o.name, price: o.price })),
      })).filter(bm => bm.outcomes.length >= 2),
    })).filter(e => e.bookmakers.length >= 2);
  } catch (err) {
    debug.push(`The Odds API: error — ${err}`);
    return [];
  }
}

// ─── Merge events from multiple sources ──────────────────────────────────

function mergeEvents(pinnacleEvents: NormalizedOdds[], otherEvents: NormalizedOdds[]): NormalizedOdds[] {
  const merged: NormalizedOdds[] = [];
  const matchKey = (home: string, away: string) =>
    `${home.toLowerCase().slice(0, 6)}|${away.toLowerCase().slice(0, 6)}`;

  // For each event from otherEvents, try to find matching Pinnacle event and merge
  for (const ev of otherEvents) {
    const key = matchKey(ev.homeTeam, ev.awayTeam);
    const pinnacleMatch = pinnacleEvents.find(p => matchKey(p.homeTeam, p.awayTeam) === key);

    if (pinnacleMatch) {
      // Merge Pinnacle bookmaker into this event
      merged.push({
        ...ev,
        bookmakers: [...ev.bookmakers, ...pinnacleMatch.bookmakers],
      });
    } else {
      merged.push(ev);
    }
  }

  // Add any Pinnacle events that had no match in otherEvents
  for (const pev of pinnacleEvents) {
    const key = matchKey(pev.homeTeam, pev.awayTeam);
    const alreadyMerged = merged.some(e => matchKey(e.homeTeam, e.awayTeam) === key);
    if (!alreadyMerged) merged.push(pev);
  }

  return merged;
}

// ─── Smart Router ─────────────────────────────────────────────────────────

export async function smartScan(sportKey: string): Promise<ScanResult> {
  const cacheKey = `scan:${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return { events: cached, sources: ['cache'], debug: [`Cache: ${cached.length} events`] };

  const debug: string[] = [];
  const sources: string[] = [];

  // Fetch from all sources in parallel where possible
  const [pinnacleEvents, oioEvents, papiEvents] = await Promise.all([
    fetchPinnacle(sportKey, debug),
    fetchOddsApiIo(sportKey, debug),
    fetchOddsPapi(sportKey, debug),
  ]);

  // Build base event list: prefer OddsPapi (most complete), then oio
  let baseEvents: NormalizedOdds[] = [];

  if (papiEvents.length > 0) {
    baseEvents = papiEvents;
    sources.push('OddsPapi');
  } else if (oioEvents.length > 0) {
    baseEvents = oioEvents;
    sources.push('odds-api.io');
  }

  // Always merge Pinnacle data if available
  if (pinnacleEvents.length > 0) {
    sources.push('Pinnacle');
    if (baseEvents.length > 0) {
      baseEvents = mergeEvents(pinnacleEvents, baseEvents);
    } else {
      baseEvents = pinnacleEvents;
    }
  }

  // Final fallback: The Odds API
  if (baseEvents.length === 0) {
    const todaEvents = await fetchTheOddsAPI(sportKey, debug);
    if (todaEvents.length > 0) {
      baseEvents = todaEvents;
      sources.push('The Odds API');
    }
  }

  debug.push(`Total: ${baseEvents.length} events from [${sources.join(' + ') || 'none'}]`);
  if (baseEvents.length > 0) setCache(cacheKey, baseEvents);
  return { events: baseEvents, sources, debug };
}
