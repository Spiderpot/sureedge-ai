export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { detectArbitrage, sortArbs } from '@/lib/arb-detector';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDSPAPI_BASE = 'https://api.oddspapi.io/v4';

const SPORT_MAP: Record<string, string[]> = {
  football:   ['soccer_epl', 'soccer_spain_la_liga'],
  soccer:     ['soccer_epl'],
  basketball: ['basketball_nba'],
  tennis:     ['tennis_atp_french_open'],
  baseball:   ['baseball_mlb'],
  hockey:     ['icehockey_nhl'],
  mma:        ['mma_mixed_martial_arts'],
  all:        ['basketball_nba', 'soccer_epl', 'baseball_mlb'],
};

const ODDSPAPI_SPORT_IDS: Record<string, number> = {
  'basketball_nba': 11, 'soccer_epl': 10, 'soccer_spain_la_liga': 10,
  'baseball_mlb': 13, 'icehockey_nhl': 15, 'tennis_atp_french_open': 12,
  'mma_mixed_martial_arts': 20,
};

async function fetchOddsPapi(sportKey: string) {
  const apiKey = process.env.ODDSPAPI_API_KEY;
  if (!apiKey) return [];

  const sportId = ODDSPAPI_SPORT_IDS[sportKey];
  if (!sportId) return [];

  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const res = await fetch(`${ODDSPAPI_BASE}/fixtures?` + new URLSearchParams({
      apiKey, sportId: String(sportId), hasOdds: 'true',
      from: now.toISOString(), to: tomorrow.toISOString(),
    }), { cache: 'no-store' });

    if (!res.ok) return [];
    const fixtures = (await res.json()).filter((f: Record<string, unknown>) => f.hasOdds);
    if (fixtures.length === 0) return [];

    const marketId = sportKey.startsWith('soccer') ? '101' : '111';
    const events: { id: string; sport_title: string; home_team: string; away_team: string; commence_time: string; bookmakers: { key: string; title: string; markets: { key: string; outcomes: { name: string; price: number }[] }[] }[] }[] = [];

    for (const fixture of fixtures.slice(0, 3)) {
      const oddsRes = await fetch(`${ODDSPAPI_BASE}/odds?` + new URLSearchParams({
        apiKey, fixtureId: String(fixture.fixtureId), oddsFormat: 'decimal',
      }), { cache: 'no-store' });
      if (!oddsRes.ok) continue;

      const oddsData = await oddsRes.json();
      const bookmakerOdds = oddsData.bookmakerOdds || {};
      const homeTeam = fixture.participant1Name || '';
      const awayTeam = fixture.participant2Name || '';
      const bookmakers: { key: string; title: string; markets: { key: string; outcomes: { name: string; price: number }[] }[] }[] = [];

      for (const [slug, bmData] of Object.entries(bookmakerOdds)) {
        const markets = (bmData as Record<string, unknown>).markets as Record<string, Record<string, unknown>> | undefined;
        if (!markets?.[marketId]) continue;
        const outcomesObj = (markets[marketId] as Record<string, unknown>).outcomes as Record<string, Record<string, unknown>> | undefined;
        if (!outcomesObj) continue;

        const outcomes: { name: string; price: number }[] = [];
        for (const [oid, od] of Object.entries(outcomesObj)) {
          const price = ((od as Record<string, unknown>).players as Record<string, Record<string, unknown>>)?.['0']?.price as number | undefined;
          let name = '';
          if (marketId === '101') { name = oid === '101' ? homeTeam : oid === '102' ? 'Draw' : oid === '103' ? awayTeam : ''; }
          else { name = oid === '111' ? homeTeam : oid === '112' ? awayTeam : ''; }
          if (!name) name = ((od as Record<string, unknown>).outcomeName as string) || '';
          if (price && price > 1.01 && name) outcomes.push({ name, price });
        }

        if (outcomes.length >= 2) bookmakers.push({ key: slug.toLowerCase(), title: slug, markets: [{ key: 'h2h', outcomes }] });
      }

      if (bookmakers.length >= 2) events.push({
        id: String(fixture.fixtureId), sport_title: fixture.sportName || sportKey,
        home_team: homeTeam, away_team: awayTeam,
        commence_time: fixture.startTime || new Date().toISOString(), bookmakers,
      });
    }
    return events;
  } catch { return []; }
}

async function fetchOddsAPI(sportKey: string) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { events: [], quotaRemaining: 0 };

  const res = await fetch(`${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
    apiKey, regions: 'us,uk,eu,au', markets: 'h2h', oddsFormat: 'decimal', dateFormat: 'iso',
  }), { cache: 'no-store' });

  const quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);
  if (!res.ok || quotaRemaining < 5) return { events: [], quotaRemaining };
  return { events: await res.json(), quotaRemaining };
}

async function handleScan(sport: string) {
  const sportsToScan = SPORT_MAP[sport.toLowerCase()] || ['basketball_nba'];
  let allArbs: ReturnType<typeof detectArbitrage> = [];
  const debug: string[] = [];

  for (const sportKey of sportsToScan) {
    // PRIMARY: OddsPapi
    let events = await fetchOddsPapi(sportKey);
    if (events.length > 0) {
      debug.push(`OddsPapi: ${events.length} events for ${sportKey}`);
    } else {
      // BACKUP: The Odds API
      const backup = await fetchOddsAPI(sportKey);
      events = backup.events;
      debug.push(events.length > 0
        ? `Odds API: ${events.length} events (${backup.quotaRemaining} credits left)`
        : `No events for ${sportKey}`);
    }

    for (const event of events) {
      allArbs.push(...detectArbitrage(event, 0));
    }
  }

  return { surebets: sortArbs(allArbs), debug };
}

export async function GET(request: NextRequest) {
  try {
    const sport = new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport);
    return success({
      totalFound: result.surebets.length,
      genuineArbs: result.surebets.filter(a => a.isGenuineArb).length,
      surebets: result.surebets,
      debug: result.debug,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { sport?: string };
    const result = await handleScan(body.sport || 'all');
    return success({
      totalFound: result.surebets.length,
      genuineArbs: result.surebets.filter(a => a.isGenuineArb).length,
      surebets: result.surebets,
      debug: result.debug,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}
