/**
 * SureEdge AI — Sharp Divergence Detection Engine
 *
 * Core logic: Detect when soft books lag behind Pinnacle (sharp reference).
 * This lag window = opportunity.
 *
 * NOT just pure arbitrage — any meaningful price divergence is an opportunity.
 */

import { resolveBookmaker, isPinnacle, isFocusedBook } from './normalizer';

export type ArbTier = 'EXECUTE' | 'VERIFY' | 'SUSPICIOUS' | 'NEAR_ARB';

export interface ArbOutcome {
  outcome:      string;
  odds:         number;
  bookmaker:    string;
  bookmakerKey: string;
  url:          string;
  deposit:      string;
  access:       string;
  isFunded:     boolean;
  isPinnacle:   boolean;
  impliedProb:  number;
  stake:        number;
  stakeRounded: number;
  potentialReturn: number;
}

export interface DetectedArb {
  id:              string;
  match:           string;
  sport:           string;
  commenceTime:    string;
  arbPercentage:   number;
  profit:          number;
  isGenuineArb:    boolean;
  tier:            ArbTier;
  tierLabel:       string;
  confidence:      number;
  edgeScore:       number;      // 0-100 composite score
  volatility:      'LOW' | 'MEDIUM' | 'HIGH';
  hasPinnacle:     boolean;
  pinnacleIsBase:  boolean;
  divergenceType:  string;      // "PINNACLE_LAG" | "SOFT_BOOK_ERROR" | "ARBITRAGE"
  accessTag:       string;
  bookmakerCount:  number;
  warnings:        string[];
  outcomes:        ArbOutcome[];
  expiresAt:       string;
  detectedAt:      string;
}

const STAKE = 10;

// Sport volatility rankings — higher = more opportunities
export const SPORT_VOLATILITY: Record<string, number> = {
  'table_tennis':              100,
  'mma_mixed_martial_arts':     95,
  'basketball_nba':             85,
  'icehockey_nhl':              80,
  'tennis_atp_french_open':     75,
  'tennis_wta_french_open':     75,
  'baseball_mlb':               65,
  'soccer_spain_la_liga':       55,
  'soccer_germany_bundesliga':  50,
  'soccer_italy_serie_a':       50,
  'soccer_france_ligue_one':    50,
  'soccer_epl':                 40,  // Too efficient
  'soccer_uefa_champs_league':  35,  // Too efficient
};

export function getSportVolatility(sport: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const score = SPORT_VOLATILITY[sport] ?? 50;
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

// Edge Score formula (0-100)
function calcEdgeScore(
  arbPct:       number,
  hasPinnacle:  boolean,
  bookCount:    number,
  volatility:   'LOW' | 'MEDIUM' | 'HIGH',
  isGenuine:    boolean
): number {
  let score = 0;

  // Base: arb percentage (up to 40 points)
  score += Math.min(40, arbPct * 10);

  // Pinnacle involvement (30 points) — sharp reference = high reliability
  if (hasPinnacle) score += 30;

  // Genuine arb vs divergence (15 points)
  if (isGenuine) score += 15;

  // Volatility bonus (10 points)
  if (volatility === 'HIGH')   score += 10;
  if (volatility === 'MEDIUM') score += 5;

  // Market depth (5 points)
  if (bookCount >= 4) score += 5;
  else if (bookCount >= 3) score += 3;

  return Math.min(100, Math.round(score));
}

function classifyTier(pct: number, genuine: boolean, hasPinnacle: boolean): {
  tier: ArbTier; label: string; warnings: string[];
} {
  const warnings: string[] = [];

  if (!genuine) {
    if (hasPinnacle) warnings.push('Pinnacle divergence detected — monitor for flip');
    return { tier: 'NEAR_ARB', label: 'Sharp divergence — monitor', warnings };
  }

  if (pct > 15) {
    return {
      tier: 'SUSPICIOUS',
      label: 'DO NOT BET — likely stale data',
      warnings: ['Arb > 15% = almost certainly stale odds', 'Verify on live sites first'],
    };
  }

  if (pct > 8) {
    warnings.push('High % — verify live odds before betting');
    return { tier: 'VERIFY', label: 'Verify live odds then execute', warnings };
  }

  if (hasPinnacle) warnings.push('Pinnacle lag detected — act fast');
  return { tier: 'EXECUTE', label: 'ACT NOW', warnings };
}

function classifyDivergence(hasPinnacle: boolean, isGenuine: boolean): string {
  if (hasPinnacle && isGenuine) return 'PINNACLE_LAG';
  if (!hasPinnacle && isGenuine) return 'ARBITRAGE';
  if (hasPinnacle && !isGenuine) return 'SHARP_MOVEMENT';
  return 'PRICE_DIVERGENCE';
}

export function detectArbitrage(
  event: {
    id: string;
    sport_title: string;
    home_team: string;
    away_team: string;
    commence_time: string;
    bookmakers: { key: string; title: string; markets: { key: string; outcomes: { name: string; price: number }[] }[] }[];
  },
  minPct = 0
): DetectedArb[] {
  if (event.bookmakers.length < 2) return [];

  // Filter to focused bookmakers only
  const focused = event.bookmakers.filter(bm => isFocusedBook(bm.key));
  if (focused.length < 2) return [];

  // Best odds per outcome across focused books
  const bestOdds: Record<string, { odds: number; key: string; info: ReturnType<typeof resolveBookmaker> }> = {};

  for (const bm of focused) {
    const info = resolveBookmaker(bm.key);
    if (!info) continue;
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const o of market.outcomes) {
      if (o.price <= 1.01 || o.price > 50) continue;
      if (!bestOdds[o.name] || o.price > bestOdds[o.name].odds) {
        bestOdds[o.name] = { odds: o.price, key: bm.key, info };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  // Reject same book on both sides
  if (new Set(outcomes.map(([, o]) => o.key)).size < 2) return [];

  const arbFraction  = outcomes.reduce((s, [, o]) => s + 1 / o.odds, 0);
  const arbPct       = parseFloat(((1 - arbFraction) * 100).toFixed(3));
  const genuine      = arbFraction < 1.0;
  const hasPinnacle  = outcomes.some(([, o]) => isPinnacle(o.key));

  // Include divergences down to -1% (near-arbs) plus genuine arbs
  if (arbFraction > 1.01 || arbPct < minPct) return [];

  const sport       = event.sport_title;
  const volatility  = getSportVolatility(event.sport_title.toLowerCase().replace(/\s+/g, '_'));
  const edgeScore   = calcEdgeScore(arbPct, hasPinnacle, focused.length, volatility, genuine);
  const allFunded   = outcomes.every(([, o]) => o.info?.access === 'funded');
  const anyVPN      = outcomes.some(([, o]) => o.info?.access === 'vpn');
  const accessTag   = allFunded ? '✅ YOUR BOOKS' : anyVPN ? '🌐 VPN NEEDED' : '🇳🇬 NG ACCESS';
  const { tier, label, warnings } = classifyTier(arbPct, genuine, hasPinnacle);
  const divergenceType = classifyDivergence(hasPinnacle, genuine);

  // Confidence
  let confidence = 50;
  if (hasPinnacle)      confidence += 30;
  if (focused.length >= 3) confidence += 10;
  if (arbPct > 15)      confidence -= 40;
  if (arbPct > 8)       confidence -= 15;
  confidence = Math.max(10, Math.min(100, confidence));

  const arbOutcomes: ArbOutcome[] = outcomes.map(([name, o]) => {
    const stake = parseFloat(((1 / o.odds / arbFraction) * STAKE).toFixed(2));
    return {
      outcome:         name,
      odds:            o.odds,
      bookmaker:       o.info?.name ?? o.key,
      bookmakerKey:    o.key,
      url:             o.info?.url ?? '',
      deposit:         o.info?.deposit ?? '',
      access:          o.info?.access ?? 'vpn',
      isFunded:        o.info?.access === 'funded',
      isPinnacle:      isPinnacle(o.key),
      impliedProb:     parseFloat(((1 / o.odds) * 100).toFixed(2)),
      stake,
      stakeRounded:    Math.round(stake),
      potentialReturn: parseFloat((stake * o.odds).toFixed(2)),
    };
  });

  return [{
    id:             `arb_${event.id}_${Date.now()}`,
    match:          `${event.home_team} vs ${event.away_team}`,
    sport,
    commenceTime:   event.commence_time,
    arbPercentage:  arbPct,
    profit:         genuine ? parseFloat((STAKE * arbPct / 100).toFixed(2)) : 0,
    isGenuineArb:   genuine,
    tier,
    tierLabel:      label,
    confidence,
    edgeScore,
    volatility,
    hasPinnacle,
    pinnacleIsBase: hasPinnacle,
    divergenceType,
    accessTag,
    bookmakerCount: focused.length,
    warnings,
    outcomes:       arbOutcomes,
    expiresAt:      new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    detectedAt:     new Date().toISOString(),
  }];
}

export function sortArbs(arbs: DetectedArb[]): DetectedArb[] {
  const tierOrder: Record<ArbTier, number> = { EXECUTE: 0, VERIFY: 1, SUSPICIOUS: 2, NEAR_ARB: 3 };
  return [...arbs].sort((a, b) => {
    if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
    return b.edgeScore - a.edgeScore; // Sort by edge score within tier
  });
}
