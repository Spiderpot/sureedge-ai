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

const ALL_SPORTS = [
  'basketball_nba',
  'baseball_mlb',
];

// Bookmakers accessible from Nigeria — no VPN needed
const NIGERIA_BOOKMAKERS: Record<string, { name: string; deposit: string; accessible: boolean }> = {
  '1xbet':        { name: '1xBet',      deposit: 'Naira, bank transfer, USSD', accessible: true },
  'onexbet':      { name: '1xBet',      deposit: 'Naira, bank transfer, USSD', accessible: true },
  'betway':       { name: 'Betway',     deposit: 'Naira, bank transfer, card',  accessible: true },
  '22bet':        { name: '22Bet',      deposit: 'Naira, bank transfer, crypto', accessible: true },
  'marathonbet':  { name: 'MarathonBet', deposit: 'Crypto, e-wallets',          accessible: true },
  'pinnacle':     { name: 'Pinnacle',   deposit: 'Crypto, agents',              accessible: true },
  'sport888':     { name: '888sport',   deposit: 'E-wallets',                   accessible: true },
  'betonlineag':  { name: 'BetOnline',  deposit: 'Crypto',                      accessible: true },
  'bovada':       { name: 'Bovada',     deposit: 'Crypto',                      accessible: true },
  'mybookieag':   { name: 'MyBookie',   deposit: 'Crypto',                      accessible: true },
  'betus':        { name: 'BetUS',      deposit: 'Crypto',                      accessible: true },
  'williamhill':  { name: 'William Hill', deposit: 'VPN required',              accessible: false },
  'betfair':      { name: 'Betfair',    deposit: 'VPN required',                accessible: false },
  'tipico':       { name: 'Tipico',     deposit: 'VPN required',                accessible: false },
  'draftkings':   { name: 'DraftKings', deposit: 'US only',                     accessible: false },
  'fanduel':      { name: 'FanDuel',    deposit: 'US only',                     accessible: false },
  'betmgm':       { name: 'BetMGM',     deposit: 'US only',                     accessible: false },
  'caesars':      { name: 'Caesars',     deposit: 'US only',                     accessible: false },
};

function isNigeriaAccessible(bookmakerKey: string): boolean {
  const bm = NIGERIA_BOOKMAKERS[bookmakerKey.toLowerCase()];
  return bm ? bm.accessible : false; // unknown bookmakers default to not accessible
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
  const sportsToScan = sportLower === 'all'
    ? ALL_SPORTS
    : [SPORT_MAP[sportLower] ?? 'basketball_nba'];

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

  // Sort: Nigeria-accessible arbs first, then by profit
  allSurebets.sort((a, b) => {
    const aAccess = a.accessTag === 'FULL_ACCESS' ? 2 : a.accessTag === 'PARTIAL_ACCESS' ? 1 : 0;
    const bAccess = b.accessTag === 'FULL_ACCESS' ? 2 : b.accessTag === 'PARTIAL_ACCESS' ? 1 : 0;
    if (aAccess !== bAccess) return bAccess - aAccess;
    return (b.arbPercentage as number) - (a.arbPercentage as number);
  });

  return { surebets: allSurebets, quotaUsed, quotaRemaining, debug };
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
