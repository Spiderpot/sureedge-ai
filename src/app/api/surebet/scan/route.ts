export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { smartScan, NormalizedOdds } from '@/lib/odds-engine';

const SPORT_MAP: Record<string, string> = {
  football:   'soccer_epl',
  soccer:     'soccer_epl',
  basketball: 'basketball_nba',
  tennis:     'tennis_atp_french_open',
  baseball:   'baseball_mlb',
  hockey:     'icehockey_nhl',
  mma:        'mma_mixed_martial_arts',
  all:        'all',
};

const FOOTBALL_LEAGUES = [
  'soccer_epl',
  'soccer_spain_la_liga',
];

const ALL_SPORTS = [
  'soccer_epl',
  'baseball_mlb',
];

// Nigeria-accessible bookmakers
const NG_BOOKMAKERS: Record<string, { name: string; deposit: string; url: string }> = {
  '1xbet':       { name: '1xBet',       deposit: 'Naira, bank, USSD',  url: 'https://1xbet.ng' },
  'onexbet':     { name: '1xBet',       deposit: 'Naira, bank, USSD',  url: 'https://1xbet.ng' },
  'betway':      { name: 'Betway',      deposit: 'Naira, bank, card',  url: 'https://betway.com.ng' },
  '22bet':       { name: '22Bet',       deposit: 'Naira, bank, crypto', url: 'https://22bet.ng' },
  'marathonbet': { name: 'MarathonBet', deposit: 'Crypto, e-wallets',  url: 'https://marathonbet.com' },
  'pinnacle':    { name: 'Pinnacle',    deposit: 'Crypto, agents',     url: 'https://pinnacle.com' },
  'sport888':    { name: '888sport',    deposit: 'E-wallets',          url: 'https://888sport.com' },
  'betonlineag': { name: 'BetOnline',   deposit: 'Crypto',            url: 'https://betonline.ag' },
  'bovada':      { name: 'Bovada',      deposit: 'Crypto',            url: 'https://bovada.lv' },
  'mybookieag':  { name: 'MyBookie',    deposit: 'Crypto',            url: 'https://mybookie.ag' },
  'betus':       { name: 'BetUS',       deposit: 'Crypto',            url: 'https://betus.com.pa' },
};

function isNGAccessible(key: string): boolean {
  return key.toLowerCase() in NG_BOOKMAKERS;
}

function getNG(key: string) {
  return NG_BOOKMAKERS[key.toLowerCase()] || null;
}

function detectArbitrage(event: NormalizedOdds) {
  if (event.bookmakers.length < 2) return [];

  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  for (const bm of event.bookmakers) {
    for (const o of bm.outcomes) {
      if (!bestOdds[o.name] || o.price > bestOdds[o.name].odds) {
        bestOdds[o.name] = { odds: o.price, key: bm.key, title: bm.title };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction >= 1.05) return [];

  const allNG = outcomes.every(([, o]) => isNGAccessible(o.key));
  if (!allNG) return []; // Nigeria-only filter

  return [{
    id:             `arb_${event.eventId}_${Date.now()}`,
    eventId:        event.eventId,
    match:          `${event.homeTeam} vs ${event.awayTeam}`,
    sport:          event.sportTitle,
    league:         event.sportTitle,
    commenceTime:   event.commenceTime,
    arbPercentage:  arbPct,
    arbFraction:    parseFloat(arbFraction.toFixed(6)),
    profit:         arbPct,
    roi:            arbPct,
    isGenuineArb:   arbFraction < 1.0,
    riskLevel:      arbFraction < 1.0 ? 'LOW' : 'MEDIUM',
    bookmakerCount: event.bookmakers.length,
    accessTag:      'FULL_ACCESS',
    outcomes: outcomes.map(([name, o]) => {
      const ng = getNG(o.key);
      return {
        outcome:       name,
        odds:          o.odds,
        bookmaker:     ng?.name || o.title,
        bookmakerKey:  o.key,
        impliedProb:   parseFloat(((1 / o.odds) * 100).toFixed(2)),
        nigeriaAccess: true,
        depositMethod: ng?.deposit || '',
        bookmakerUrl:  ng?.url || '',
      };
    }),
    status:     'active',
    detectedAt: new Date().toISOString(),
    expiresAt:  new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }];
}

async function handleScan(sport: string) {
  const sportLower = sport.toLowerCase();
  let sportsToScan: string[];

  if (sportLower === 'all') {
    sportsToScan = ALL_SPORTS;
  } else if (sportLower === 'football' || sportLower === 'soccer') {
    sportsToScan = FOOTBALL_LEAGUES;
  } else {
    sportsToScan = [SPORT_MAP[sportLower] ?? 'basketball_nba'];
  }

  const allSurebets: Record<string, unknown>[] = [];
  const allDebug: string[] = [];
  const allSources = new Set<string>();
  let quotaUsed = 0;
  let quotaRemaining = 0;
  let totalScanned = 0;

  for (const sportKey of sportsToScan) {
    const result = await smartScan(sportKey);

    quotaUsed = result.quotaUsed || quotaUsed;
    quotaRemaining = result.quotaRemaining || quotaRemaining;
    allDebug.push(...result.debug);
    result.sources.forEach(s => allSources.add(s));

    for (const event of result.events) {
      const arbs = detectArbitrage(event);
      totalScanned++;
      allSurebets.push(...arbs);
    }
  }

  allSurebets.sort((a, b) => (b.arbPercentage as number) - (a.arbPercentage as number));

  return {
    surebets: allSurebets,
    totalScanned,
    sources: [...allSources],
    quotaUsed,
    quotaRemaining,
    debug: allDebug,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sport = new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport);
    return success({
      totalFound:     result.surebets.length,
      totalScanned:   result.totalScanned,
      sources:        result.sources,
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
  try {
    const body = await request.json().catch(() => ({})) as { sport?: string };
    const sport = body.sport || new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport);
    return success({
      totalFound:     result.surebets.length,
      totalScanned:   result.totalScanned,
      sources:        result.sources,
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
