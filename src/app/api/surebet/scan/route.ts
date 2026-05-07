export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

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

// Additional football leagues for broader coverage
const FOOTBALL_LEAGUES = [
  'soccer_epl',            // English Premier League
  'soccer_spain_la_liga',  // La Liga
  'soccer_italy_serie_a',  // Serie A
  'soccer_germany_bundesliga', // Bundesliga
  'soccer_france_ligue_one',   // Ligue 1
  'soccer_uefa_champs_league', // Champions League
];

// "All" scans top 2 sports to conserve credits (4 credits each = 8 total)
// Individual sport filters scan that sport only (4 credits)
const ALL_SPORTS = [
  'soccer_epl',       // EPL — daytime Lagos, most NG bookmaker coverage
  'baseball_mlb',     // MLB — nighttime Lagos, high arb frequency
];

// Bookmakers accessible from Nigeria — no VPN needed
const NIGERIA_BOOKMAKERS: Record<string, { name: string; deposit: string; accessible: boolean; url: string }> = {
  '1xbet':        { name: '1xBet',      deposit: 'Naira, bank transfer, USSD', accessible: true, url: 'https://1xbet.ng' },
  'onexbet':      { name: '1xBet',      deposit: 'Naira, bank transfer, USSD', accessible: true, url: 'https://1xbet.ng' },
  'betway':       { name: 'Betway',     deposit: 'Naira, bank transfer, card',  accessible: true, url: 'https://betway.com.ng' },
  '22bet':        { name: '22Bet',      deposit: 'Naira, bank transfer, crypto', accessible: true, url: 'https://22bet.ng' },
  'marathonbet':  { name: 'MarathonBet', deposit: 'Crypto, e-wallets',          accessible: true, url: 'https://marathonbet.com' },
  'pinnacle':     { name: 'Pinnacle',   deposit: 'Crypto, agents',              accessible: true, url: 'https://pinnacle.com' },
  'sport888':     { name: '888sport',   deposit: 'E-wallets',                   accessible: true, url: 'https://888sport.com' },
  'betonlineag':  { name: 'BetOnline',  deposit: 'Crypto',                      accessible: true, url: 'https://betonline.ag' },
  'bovada':       { name: 'Bovada',     deposit: 'Crypto',                      accessible: true, url: 'https://bovada.lv' },
  'mybookieag':   { name: 'MyBookie',   deposit: 'Crypto',                      accessible: true, url: 'https://mybookie.ag' },
  'betus':        { name: 'BetUS',      deposit: 'Crypto',                      accessible: true, url: 'https://betus.com.pa' },
  'williamhill':  { name: 'William Hill', deposit: 'VPN required',              accessible: false, url: '' },
  'betfair':      { name: 'Betfair',    deposit: 'VPN required',                accessible: false, url: '' },
  'tipico':       { name: 'Tipico',     deposit: 'VPN required',                accessible: false, url: '' },
  'draftkings':   { name: 'DraftKings', deposit: 'US only',                     accessible: false, url: '' },
  'fanduel':      { name: 'FanDuel',    deposit: 'US only',                     accessible: false, url: '' },
  'betmgm':       { name: 'BetMGM',     deposit: 'US only',                     accessible: false, url: '' },
  'caesars':      { name: 'Caesars',     deposit: 'US only',                     accessible: false, url: '' },
};

function isNigeriaAccessible(bookmakerKey: string): boolean {
  const bm = NIGERIA_BOOKMAKERS[bookmakerKey.toLowerCase()];
  return bm ? bm.accessible : false; // unknown bookmakers default to not accessible
}

function getBookmakerUrl(bookmakerKey: string): string {
  const bm = NIGERIA_BOOKMAKERS[bookmakerKey.toLowerCase()];
  return bm ? bm.url : '';
}

function getDepositMethod(bookmakerKey: string): string {
  const bm = NIGERIA_BOOKMAKERS[bookmakerKey.toLowerCase()];
  return bm ? bm.deposit : 'Check availability';
}

interface Outcome { name: string; price: number }
interface Market { key: string; outcomes: Outcome[] }
interface Bookmaker { key: string; title: string; markets: Market[] }
interface Event {
  id: string; sport_key: string; sport_title: string;
  commence_time: string; home_team: string; away_team: string;
  bookmakers: Bookmaker[];
}

function detectArbitrage(event: Event) {
  if (event.bookmakers.length < 2) return [];

  // Best odds across ALL bookmakers
  const bestOdds: Record<string, { odds: number; bookmaker: string; title: string; key: string }> = {};
  for (const bm of event.bookmakers) {
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const outcome of market.outcomes) {
      if (!bestOdds[outcome.name] || outcome.price > bestOdds[outcome.name].odds) {
        bestOdds[outcome.name] = { odds: outcome.price, bookmaker: bm.key, title: bm.title, key: bm.key };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction < 1.05) {
    const allAccessible = outcomes.every(([, o]) => isNigeriaAccessible(o.bookmaker));
    const someAccessible = outcomes.some(([, o]) => isNigeriaAccessible(o.bookmaker));

    // Accessibility tag for Nigeria users
    const accessTag = allAccessible ? 'FULL_ACCESS' : someAccessible ? 'PARTIAL_ACCESS' : 'VPN_REQUIRED';

    return [{
      id:            `arb_${event.id}_${Date.now()}`,
      eventId:       event.id,
      match:         `${event.home_team} vs ${event.away_team}`,
      sport:         event.sport_title,
      league:        event.sport_title,
      commenceTime:  event.commence_time,
      arbPercentage: arbPct,
      arbFraction:   parseFloat(arbFraction.toFixed(6)),
      profit:        arbPct,
      roi:           arbPct,
      isGenuineArb:  arbFraction < 1.0,
      riskLevel:     arbFraction < 1.0 ? 'LOW' : 'MEDIUM',
      bookmakerCount: event.bookmakers.length,
      accessTag,
      outcomes: outcomes.map(([name, o]) => ({
        outcome:       name,
        odds:          o.odds,
        bookmaker:     o.title,
        bookmakerKey:  o.bookmaker,
        impliedProb:   parseFloat(((1 / o.odds) * 100).toFixed(2)),
        nigeriaAccess: isNigeriaAccessible(o.bookmaker),
        depositMethod: getDepositMethod(o.bookmaker),
        bookmakerUrl:  getBookmakerUrl(o.bookmaker),
      })),
      status:     'active',
      detectedAt: new Date().toISOString(),
      expiresAt:  new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }];
  }

  return [];
}

async function handleScan(sport: string, apiKey: string) {
  const sportLower = sport.toLowerCase();
  let sportsToScan: string[];

  if (sportLower === 'all') {
    sportsToScan = ALL_SPORTS;
  } else if (sportLower === 'football' || sportLower === 'soccer') {
    // Football scans multiple leagues for maximum coverage
    sportsToScan = FOOTBALL_LEAGUES.slice(0, 2); // 2 leagues = 8 credits
  } else {
    sportsToScan = [SPORT_MAP[sportLower] ?? 'basketball_nba'];
  }

  const allSurebets: Record<string, unknown>[] = [];
  const debug: string[] = [];
  let quotaUsed = 0;
  let quotaRemaining = 0;

  for (const sportKey of sportsToScan) {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'us,uk,eu,au',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
    quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

    if (!res.ok) {
      if (res.status === 401) return { err: 'Invalid ODDS_API_KEY', code: 401 };
      if (res.status === 422) { debug.push(`${sportKey}: no events`); continue; }
      if (res.status === 429) return { err: 'Quota exceeded', code: 429 };
      debug.push(`${sportKey}: HTTP ${res.status}`);
      continue;
    }

    const events: Event[] = await res.json();
    debug.push(`${sportKey}: ${events.length} events, ${events.reduce((s, e) => s + e.bookmakers.length, 0)} bookmakers`);

    for (const event of events) {
      allSurebets.push(...detectArbitrage(event));
    }
  }

  // ONLY return arbs where BOTH bookmakers are Nigeria-accessible
  const nigeriaOnly = allSurebets.filter(s => s.accessTag === 'FULL_ACCESS');

  // Sort by profit
  nigeriaOnly.sort((a, b) => {
    const aAccess = a.accessTag === 'FULL_ACCESS' ? 2 : a.accessTag === 'PARTIAL_ACCESS' ? 1 : 0;
    const bAccess = b.accessTag === 'FULL_ACCESS' ? 2 : b.accessTag === 'PARTIAL_ACCESS' ? 1 : 0;
    if (aAccess !== bAccess) return bAccess - aAccess;
    return (b.arbPercentage as number) - (a.arbPercentage as number);
  });

  return { surebets: nigeriaOnly, totalScanned: allSurebets.length, quotaUsed, quotaRemaining, debug };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return success({ totalFound: 0, quotaUsed: 0, quotaRemaining: 0, surebets: [], message: 'ODDS_API_KEY not configured.', demoMode: true });

  try {
    const sport = new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport, apiKey);
    if ('err' in result) return error(result.err as string, result.code as number);
    return success({ totalFound: result.surebets!.length, quotaUsed: result.quotaUsed, quotaRemaining: result.quotaRemaining, surebets: result.surebets, debug: result.debug, scannedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return success({ totalFound: 0, quotaUsed: 0, quotaRemaining: 0, surebets: [], message: 'ODDS_API_KEY not configured.', demoMode: true });

  try {
    const body = await request.json().catch(() => ({})) as { sport?: string };
    const sport = body.sport || new URL(request.url).searchParams.get('sport') || 'all';
    const result = await handleScan(sport, apiKey);
    if ('err' in result) return error(result.err as string, result.code as number);
    return success({ totalFound: result.surebets!.length, quotaUsed: result.quotaUsed, quotaRemaining: result.quotaRemaining, surebets: result.surebets, debug: result.debug, scannedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Scan error:', err);
    return error('Scan failed', 500);
  }
}
