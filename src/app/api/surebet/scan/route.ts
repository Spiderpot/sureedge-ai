export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { smartScan, NormalizedOdds } from '@/lib/odds-engine';

// Full sport mapping — all active leagues
const SPORT_MAP: Record<string, string[]> = {
  football:   ['soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a', 'soccer_germany_bundesliga', 'soccer_france_ligue_one', 'soccer_uefa_champs_league'],
  soccer:     ['soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a'],
  basketball: ['basketball_nba', 'basketball_euroleague'],
  tennis:     ['tennis_atp_french_open', 'tennis_wta_french_open'],
  baseball:   ['baseball_mlb'],
  hockey:     ['icehockey_nhl'],
  mma:        ['mma_mixed_martial_arts'],
};

// "All Sports" — scan best arb sports first (ranked by historical arb frequency)
const ALL_SPORTS_RANKED = [
  'basketball_nba',            // #1 — most bookmaker competition, highest arb %
  'soccer_epl',                // #2 — massive global coverage, Pinnacle vs 1xBet gold
  'baseball_mlb',              // #3 — high volume, good spreads
  'soccer_spain_la_liga',      // #4 — top European league
  'icehockey_nhl',             // #5 — decent arb frequency
  'tennis_atp_french_open',    // #6 — 2-way market = clean arbs
  'mma_mixed_martial_arts',    // #7 — sharp line movements
  'soccer_uefa_champs_league', // #8 — massive when in season
];

// Nigeria-accessible bookmakers — RANKED by arb value
// Pinnacle is #1 priority — sharpest odds, creates biggest spreads vs soft books
const NG_BOOKMAKERS: Record<string, { name: string; deposit: string; url: string; tier: number }> = {
  // Tier 1: Sharp books — these CREATE arb opportunities
  'pinnacle':    { name: 'Pinnacle',    deposit: 'Crypto (USDT TRC-20)',  url: 'https://pinnacle.com',     tier: 1 },

  // Tier 2: Nigerian books with Naira deposit — these are the OTHER side of the arb  
  '1xbet':       { name: '1xBet',       deposit: 'Naira, bank, USSD',    url: 'https://1xbet.ng',         tier: 2 },
  'onexbet':     { name: '1xBet',       deposit: 'Naira, bank, USSD',    url: 'https://1xbet.ng',         tier: 2 },
  '22bet':       { name: '22Bet',       deposit: 'Naira, bank, crypto',  url: 'https://22bet.ng',         tier: 2 },
  'betway':      { name: 'Betway',      deposit: 'Naira, bank, card',    url: 'https://betway.com.ng',    tier: 2 },
  'bet9ja':      { name: 'Bet9ja',      deposit: 'Naira, bank, USSD',    url: 'https://bet9ja.com',       tier: 2 },
  'sportybet':   { name: 'SportyBet',   deposit: 'Naira, bank, USSD',    url: 'https://sportybet.com',    tier: 2 },
  'betika':      { name: 'Betika',      deposit: 'Mobile money',         url: 'https://betika.com',       tier: 2 },
  'msport':      { name: 'MSport',      deposit: 'Naira, bank',          url: 'https://msport.com',       tier: 2 },
  'melbet':      { name: 'MelBet',      deposit: 'Naira, crypto',        url: 'https://melbet.com',       tier: 2 },
  'betwinner':   { name: 'BetWinner',   deposit: 'Naira, crypto',        url: 'https://betwinner.com',    tier: 2 },

  // Tier 3: Crypto-accessible books — expand coverage
  'marathonbet': { name: 'MarathonBet', deposit: 'Crypto, e-wallets',    url: 'https://marathonbet.com',  tier: 3 },
  'betonlineag': { name: 'BetOnline',   deposit: 'Crypto (BTC/USDT)',    url: 'https://betonline.ag',     tier: 3 },
  'bovada':      { name: 'Bovada',      deposit: 'Crypto (BTC/USDT)',    url: 'https://bovada.lv',        tier: 3 },
  'mybookieag':  { name: 'MyBookie',    deposit: 'Crypto',               url: 'https://mybookie.ag',      tier: 3 },
  'betus':       { name: 'BetUS',       deposit: 'Crypto',               url: 'https://betus.com.pa',     tier: 3 },
  'sport888':    { name: '888sport',    deposit: 'E-wallets',            url: 'https://888sport.com',     tier: 3 },
};

function isNGAccessible(key: string): boolean {
  return key.toLowerCase() in NG_BOOKMAKERS;
}

function getNG(key: string) {
  return NG_BOOKMAKERS[key.toLowerCase()] || null;
}

function getTier(key: string): number {
  return NG_BOOKMAKERS[key.toLowerCase()]?.tier || 99;
}

function detectArbitrage(event: NormalizedOdds) {
  if (event.bookmakers.length < 2) return [];

  // Find best odds per outcome across ALL bookmakers
  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  for (const bm of event.bookmakers) {
    for (const o of bm.outcomes) {
      if (o.price <= 1.01) continue; // Filter garbage odds
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

  // Nigeria filter — both bookmakers must be accessible
  const allNG = outcomes.every(([, o]) => isNGAccessible(o.key));
  if (!allNG) return [];

  // Priority scoring: Pinnacle arbs rank higher
  const hasPinnacle = outcomes.some(([, o]) => o.key.toLowerCase() === 'pinnacle');
  const hasSharpSoft = outcomes.some(([, o]) => getTier(o.key) === 1) && 
                       outcomes.some(([, o]) => getTier(o.key) >= 2);
  
  // Risk assessment
  let riskLevel: string;
  if (arbFraction < 1.0 && hasPinnacle) riskLevel = 'LOW';      // Best: sharp + soft = reliable
  else if (arbFraction < 1.0)           riskLevel = 'LOW';       // Genuine arb
  else if (arbFraction < 1.02)          riskLevel = 'MEDIUM';    // Near-arb, might flip
  else                                  riskLevel = 'HIGH';      // Wide margin, less reliable

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
    riskLevel,
    bookmakerCount: event.bookmakers.length,
    accessTag:      'FULL_ACCESS',
    hasPinnacle,
    hasSharpSoft,
    priorityScore:  (arbPct * 10) + (hasPinnacle ? 50 : 0) + (hasSharpSoft ? 30 : 0),
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
        tier:          getTier(o.key),
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
    // Scan top 3 sports to balance coverage vs API cost
    sportsToScan = ALL_SPORTS_RANKED.slice(0, 3);
  } else if (SPORT_MAP[sportLower]) {
    // Individual sport — scan up to 2 leagues
    sportsToScan = SPORT_MAP[sportLower].slice(0, 2);
  } else {
    sportsToScan = ['basketball_nba'];
  }

  const allSurebets: Record<string, unknown>[] = [];
  const allDebug: string[] = [];
  const allSources = new Set<string>();
  let quotaUsed = 0;
  let quotaRemaining = 0;
  let totalEvents = 0;

  for (const sportKey of sportsToScan) {
    const result = await smartScan(sportKey);
    quotaUsed = result.quotaUsed || quotaUsed;
    quotaRemaining = result.quotaRemaining || quotaRemaining;
    allDebug.push(...result.debug);
    result.sources.forEach(s => allSources.add(s));

    for (const event of result.events) {
      totalEvents++;
      allSurebets.push(...detectArbitrage(event));
    }
  }

  // Sort by priority score: Pinnacle arbs first, then by arb %
  allSurebets.sort((a, b) => (b.priorityScore as number) - (a.priorityScore as number));

  return {
    surebets: allSurebets,
    totalEvents,
    sportsScanned: sportsToScan,
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
      totalEvents:    result.totalEvents,
      sportsScanned:  result.sportsScanned,
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
      totalEvents:    result.totalEvents,
      sportsScanned:  result.sportsScanned,
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
