export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { detectArbitrage, sortArbs } from '@/lib/arb-detector';
import { smartScan } from '@/lib/odds-engine';

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

async function handleScan(sport: string) {
  const sportsToScan = SPORT_MAP[sport.toLowerCase()] || ['basketball_nba'];
  let allArbs: ReturnType<typeof detectArbitrage> = [];
  const debug: string[] = [];

  for (const sportKey of sportsToScan) {
    const result = await smartScan(sportKey);
    debug.push(...result.debug);
    for (const event of result.events) {
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
      executeArbs: result.surebets.filter(a => a.tier === 'EXECUTE').length,
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
      executeArbs: result.surebets.filter(a => a.tier === 'EXECUTE').length,
      surebets: result.surebets,
      debug: result.debug,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}
