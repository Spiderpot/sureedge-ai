export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { detectArbitrage, sortArbs } from '@/lib/arb-detector';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

const SPORT_MAP: Record<string, string[]> = {
  football:   ['soccer_epl', 'soccer_spain_la_liga'],
  soccer:     ['soccer_epl', 'soccer_spain_la_liga'],
  basketball: ['basketball_nba'],
  tennis:     ['tennis_atp_french_open'],
  baseball:   ['baseball_mlb'],
  hockey:     ['icehockey_nhl'],
  mma:        ['mma_mixed_martial_arts'],
  all:        ['basketball_nba', 'soccer_epl', 'baseball_mlb'],
};

async function scanSport(sportKey: string, apiKey: string) {
  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
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
  const events = await res.json();
  return { events, quotaUsed, quotaRemaining };
}

async function handleScan(sport: string, apiKey: string) {
  const sportLower = sport.toLowerCase();
  const sportsToScan = SPORT_MAP[sportLower] || ['basketball_nba'];

  let allArbs: ReturnType<typeof detectArbitrage> = [];
  const debug: string[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;
  let totalEvents = 0;

  for (const sportKey of sportsToScan) {
    const result = await scanSport(sportKey, apiKey);
    quotaUsed = result.quotaUsed;
    quotaRemaining = result.quotaRemaining;
    totalEvents += result.events.length;

    const totalBm = result.events.reduce((s: number, e: { bookmakers: unknown[] }) => s + e.bookmakers.length, 0);
    debug.push(`${sportKey}: ${result.events.length} events, ${totalBm} bookmakers`);

    for (const event of result.events) {
      allArbs.push(...detectArbitrage(event, 0));
    }
  }

  allArbs = sortArbs(allArbs);

  return { surebets: allArbs, totalEvents, quotaUsed, quotaRemaining, debug };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return success({ totalFound: 0, surebets: [], message: 'ODDS_API_KEY not configured', demoMode: true });

  try {
    const sport = new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport, apiKey);
    return success({
      totalFound:     result.surebets.length,
      genuineArbs:    result.surebets.filter(a => a.isGenuineArb).length,
      totalEvents:    result.totalEvents,
      quotaUsed:      result.quotaUsed,
      quotaRemaining: result.quotaRemaining,
      surebets:       result.surebets,
      debug:          result.debug,
      scannedAt:      new Date().toISOString(),
    });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return success({ totalFound: 0, surebets: [], message: 'ODDS_API_KEY not configured', demoMode: true });

  try {
    const body = await request.json().catch(() => ({})) as { sport?: string };
    const sport = body.sport || 'all';
    const result = await handleScan(sport, apiKey);
    return success({
      totalFound:     result.surebets.length,
      genuineArbs:    result.surebets.filter(a => a.isGenuineArb).length,
      totalEvents:    result.totalEvents,
      quotaUsed:      result.quotaUsed,
      quotaRemaining: result.quotaRemaining,
      surebets:       result.surebets,
      debug:          result.debug,
      scannedAt:      new Date().toISOString(),
    });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}
