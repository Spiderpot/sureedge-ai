/**
 * SureEdge AI — Odds Engine v7
 *
 * Focused on 4 bookmakers: Pinnacle, Bet365, 1xBet, 22Bet
 *
 * PRIMARY:   OddsPapi  — all 4 books, 250/month (resets June 1)
 * SECONDARY: odds-api.io — 1xBet+22Bet+Bet365 (no Pinnacle), 100/hour
 * BACKUP:    The Odds API — Bet365+Betfair, 500/month (resets June 1)
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

// 60-second cache
const cache = new Map<string, { data: NormalizedOdds[]; ts: number }>();
const getCached = (k: string) => { const e = cache.get(k); return e && Date.now() - e.ts < 60000 ? e.data : null; };
const setCache  = (k: string, d: NormalizedOdds[]) => { cache.set(k, { data: d, ts: Date.now() }); };

// Sport mappings
const ODDSPAPI_SPORT_IDS: Record<string, number> = {
  'soccer_epl': 10, 'soccer_spain_la_liga': 10, 'soccer_italy_serie_a': 10,
  'soccer_germany_bundesliga': 10, 'soccer_france_ligue_one': 10, 'soccer_uefa_champs_league': 10,
  'basketball_nba': 11, 'baseball_mlb': 13, 'icehockey_nhl': 15,
  'tennis_atp_french_open': 12, 'mma_mixed_martial_arts': 20,
};

const OIO_SPORT_SLUGS: Record<string, string> = {
  'soccer_epl': 'football', 'soccer_spain_la_liga': 'football',
  'soccer_italy_serie_a': 'football', 'soccer_germany_bundesliga': 'football',
  'soccer_france_ligue_one': 'football', 'soccer_uefa_champs_league': 'football',
  'basketball_nba': 'basketball', 'baseball_mlb': 'baseball',
  'icehockey_nhl': 'ice-hockey', 'tennis_atp_french_open': 'tennis',
  'mma_mixed_martial_arts': 'mma',
};

// Only our 4 target books for odds-api.io
const OIO_BOOKS = '1xbet,22Bet,Bet365,Betway,Unibet,William Hill,NetBet,Tipico DE';

// ─── OddsPapi ─────────────────────────────────────────────────────────────

async function fetchOddsPapi(sport: string, debug: string[]): Promise<NormalizedOdds[]> {
  const key = process.env.ODDSPAPI_API_KEY;
  if (!key) { debug.push('OddsPapi: not configured'); return []; }

  const sportId  = ODDSPAPI_SPORT_IDS[sport];
  if (!sportId) return [];
  const marketId = sport.startsWith('soccer') ? '101' : '111';

  try {
    const now      = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const fRes = await fetch(`https://api.oddspapi.io/v4/fixtures?` + new URLSearchParams({
      apiKey: key, sportId: String(sportId), hasOdds: 'true',
      from: now.toISOString(), to: tomorrow.toISOString(),
    }), { cache: 'no-store' });

    if (!fRes.ok) { debug.push(`OddsPapi: ${fRes.status}`); return []; }
    const fixtures = (await fRes.json() as Record<string, unknown>[]).filter(f => f.hasOdds);
    if (!fixtures.length) { debug.push('OddsPapi: no fixtures'); return []; }

    debug.push(`OddsPapi: ${fixtures.length} fixtures`);
    const events: NormalizedOdds[] = [];

    for (const f of fixtures.slice(0, 5)) {
      const fid = String(f.fixtureId ?? '');
      if (!fid) continue;

      const oRes = await fetch(`https://api.oddspapi.io/v4/odds?` + new URLSearchParams({
        apiKey: key, fixtureId: fid, oddsFormat: 'decimal',
      }), { cache: 'no-store' });
      if (!oRes.ok) continue;

      const od      = await oRes.json() as Record<string, unknown>;
      const bmOdds  = (od.bookmakerOdds ?? {}) as Record<string, Record<string, unknown>>;
      const home    = String(f.participant1Name ?? '');
      const away    = String(f.participant2Name ?? '');
      const books: NormalizedOdds['bookmakers'] = [];

      for (const [slug, bm] of Object.entries(bmOdds)) {
        const mkts = (bm.markets ?? {}) as Record<string, Record<string, unknown>>;
        if (!mkts[marketId]) continue;
        const outs = ((mkts[marketId] as Record<string, unknown>).outcomes ?? {}) as Record<string, Record<string, unknown>>;
        const outcomes: { name: string; price: number }[] = [];
        for (const [oid, out] of Object.entries(outs)) {
          const p = ((out.players ?? {}) as Record<string, Record<string, unknown>>)['0']?.price as number;
          const n = marketId === '101'
            ? (oid === '101' ? home : oid === '102' ? 'Draw' : away)
            : (oid === '111' ? home : away);
          if (p && p > 1.01 && p < 50 && n) outcomes.push({ name: n, price: p });
        }
        if (outcomes.length >= 2) books.push({ key: slug.toLowerCase(), title: slug, market: 'h2h', outcomes });
      }

      if (books.length >= 2 && home) {
        events.push({ eventId: fid, sport, sportTitle: String(f.sportName ?? sport), homeTeam: home, awayTeam: away, commenceTime: String(f.startTime ?? ''), bookmakers: books });
        debug.push(`  ${home} vs ${away}: ${books.length} books`);
      }
    }
    return events;
  } catch (e) { debug.push(`OddsPapi error: ${e}`); return []; }
}

// ─── odds-api.io ──────────────────────────────────────────────────────────

async function fetchOddsApiIo(sport: string, debug: string[]): Promise<NormalizedOdds[]> {
  const key  = process.env.ODDS_API_IO_KEY;
  if (!key) { debug.push('odds-api.io: not configured'); return []; }
  const slug = OIO_SPORT_SLUGS[sport];
  if (!slug) return [];

  try {
    const evRes = await fetch(`https://api.odds-api.io/v3/events?` + new URLSearchParams({ apiKey: key, sport: slug, status: 'upcoming', limit: '10' }), { cache: 'no-store' });
    if (evRes.status === 429) { debug.push('odds-api.io: rate limited (100/hr)'); return []; }
    if (!evRes.ok) { debug.push(`odds-api.io events: ${evRes.status}`); return []; }

    const items = await evRes.json() as Record<string, unknown>[];
    if (!Array.isArray(items) || !items.length) { debug.push('odds-api.io: no events'); return []; }
    debug.push(`odds-api.io: ${items.length} events`);

    const events: NormalizedOdds[] = [];
    for (const ev of items.slice(0, 5)) {
      const eventId  = String(ev.id ?? '');
      const homeTeam = String(ev.home ?? '');
      const awayTeam = String(ev.away ?? '');
      if (!eventId || !homeTeam) continue;

      const oRes = await fetch(`https://api.odds-api.io/v3/odds?` + new URLSearchParams({ apiKey: key, eventId, market: 'moneyline', bookmakers: OIO_BOOKS }), { cache: 'no-store' });
      if (!oRes.ok) continue;

      const odds = await oRes.json() as Record<string, unknown>[];
      if (!Array.isArray(odds)) continue;

      const bmMap: Record<string, { title: string; outcomes: { name: string; price: number }[] }> = {};
      for (const o of odds) {
        const bm  = String(o.bookmaker ?? '');
        const bmk = bm.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!bmk) continue;
        if (!bmMap[bmk]) bmMap[bmk] = { title: bm, outcomes: [] };
        const name  = String(o.outcome ?? '');
        const price = Number(o.odds ?? 0);
        if (name && price > 1.01 && price < 50) bmMap[bmk].outcomes.push({ name, price });
      }

      const books = Object.entries(bmMap).filter(([, b]) => b.outcomes.length >= 2).map(([k, b]) => ({ key: k, title: b.title, market: 'h2h', outcomes: b.outcomes }));
      if (books.length >= 2) {
        const league = (ev.league as Record<string, unknown>)?.name ?? sport;
        events.push({ eventId, sport, sportTitle: String(league), homeTeam, awayTeam, commenceTime: String(ev.date ?? ''), bookmakers: books });
        debug.push(`  ${homeTeam} vs ${awayTeam}: ${books.length} books`);
      }
    }
    return events;
  } catch (e) { debug.push(`odds-api.io error: ${e}`); return []; }
}

// ─── The Odds API (backup) ────────────────────────────────────────────────

async function fetchTheOddsAPI(sport: string, debug: string[]): Promise<NormalizedOdds[]> {
  const key = process.env.ODDS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?` + new URLSearchParams({ apiKey: key, regions: 'us,uk,eu,au', markets: 'h2h', oddsFormat: 'decimal', dateFormat: 'iso' }), { cache: 'no-store' });
    const remaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);
    if (remaining < 5) { debug.push(`The Odds API: paused (${remaining} left)`); return []; }
    if (!res.ok) return [];
    const data = await res.json() as Record<string, unknown>[];
    debug.push(`The Odds API: ${data.length} events (${remaining} left)`);
    return data.map(e => ({
      eventId: String(e.id), sport, sportTitle: String(e.sport_title),
      homeTeam: String(e.home_team), awayTeam: String(e.away_team), commenceTime: String(e.commence_time),
      bookmakers: ((e.bookmakers ?? []) as Record<string, unknown>[]).map(b => ({
        key: String(b.key ?? '').toLowerCase(), title: String(b.title ?? ''), market: 'h2h',
        outcomes: (((b.markets as Record<string, unknown>[])?.[0]?.outcomes) as { name: string; price: number }[] ?? []).map(o => ({ name: o.name, price: o.price })),
      })).filter(b => b.outcomes.length >= 2),
    })).filter(e => e.bookmakers.length >= 2);
  } catch (e) { debug.push(`The Odds API error: ${e}`); return []; }
}

// ─── Smart Router ─────────────────────────────────────────────────────────

export async function smartScan(sport: string): Promise<ScanResult> {
  const cached = getCached(sport);
  if (cached) return { events: cached, sources: ['cache'], debug: [`Cache: ${cached.length} events`] };

  const debug: string[] = [];
  const sources: string[] = [];
  let events: NormalizedOdds[] = [];

  // Try all in parallel for speed
  const [papiEvents, oioEvents] = await Promise.all([
    fetchOddsPapi(sport, debug),
    fetchOddsApiIo(sport, debug),
  ]);

  if (papiEvents.length > 0) { events = papiEvents; sources.push('OddsPapi'); }
  else if (oioEvents.length > 0) { events = oioEvents; sources.push('odds-api.io'); }
  else {
    const todaEvents = await fetchTheOddsAPI(sport, debug);
    if (todaEvents.length > 0) { events = todaEvents; sources.push('The Odds API'); }
  }

  debug.push(`Total: ${events.length} events [${sources.join(' + ') || 'none'}]`);
  if (events.length > 0) setCache(sport, events);
  return { events, sources, debug };
}
