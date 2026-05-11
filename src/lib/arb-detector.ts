/**
 * SureEdge AI — Role-Based Arbitrage Detector
 * 
 * Strategy: Pinnacle as sharp reference, compare others against it.
 * Deviation from Pinnacle = opportunity signal.
 * No Pinnacle? Fall back to best-odds comparison across soft books.
 */

import { resolveBookmaker, isPinnacle, isFocusedBook, BookmakerInfo } from './normalizer';

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
  hasPinnacle:     boolean;
  pinnacleIsBase:  boolean;
  accessTag:       string;
  bookmakerCount:  number;
  warnings:        string[];
  outcomes:        ArbOutcome[];
  expiresAt:       string;
  detectedAt:      string;
}

const STAKE = 10;

function classifyTier(pct: number, genuine: boolean, hasPinnacle: boolean): {
  tier: ArbTier; label: string; warnings: string[];
} {
  const warnings: string[] = [];
  if (!genuine) return { tier: 'NEAR_ARB', label: 'Near-arb — monitor', warnings };

  if (pct > 15) {
    return {
      tier: 'SUSPICIOUS', label: 'DO NOT BET — likely stale data',
      warnings: ['Arb > 15% = almost certainly stale odds', 'Verify on live bookmaker sites first'],
    };
  }
  if (pct > 8) {
    warnings.push('High % — verify odds are still live before betting');
    if (!hasPinnacle) warnings.push('No Pinnacle — less reliable signal');
    return { tier: 'VERIFY', label: 'Verify live odds, then execute', warnings };
  }

  // 2.5-8% = sweet spot
  if (hasPinnacle) warnings.push('Pinnacle confirmed — high reliability signal');
  return { tier: 'EXECUTE', label: 'ACT NOW — verified range', warnings };
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

  // Step 1: Filter to ONLY our 4 focused bookmakers
  const focusedBooks = event.bookmakers.filter(bm => isFocusedBook(bm.key));
  if (focusedBooks.length < 2) return [];

  // Step 2: Build best-odds map across focused books
  const bestOdds: Record<string, { odds: number; key: string; info: BookmakerInfo }> = {};

  for (const bm of focusedBooks) {
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

  // Step 3: Reject if same book on multiple outcomes
  const uniqueBooks = new Set(outcomes.map(([, o]) => o.key));
  if (uniqueBooks.size < 2) return [];

  // Step 4: Calculate arb
  const arbFraction = outcomes.reduce((s, [, o]) => s + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction >= 1.05) return [];
  if (arbPct < minPct && arbFraction >= 1.0) return [];

  const genuine     = arbFraction < 1.0;
  const hasPinnacle = outcomes.some(([, o]) => isPinnacle(o.key));
  const pinnacleIsBase = hasPinnacle; // Pinnacle involved = role-based comparison

  // Step 5: Confidence scoring
  let confidence = 50;
  if (hasPinnacle)              confidence += 30; // Pinnacle = high reliability
  if (focusedBooks.length >= 3) confidence += 10; // More books = more reliable
  if (arbPct > 15)              confidence -= 40; // Suspicious
  if (arbPct > 8)               confidence -= 15; // Needs verification
  confidence = Math.max(10, Math.min(100, confidence));

  // Step 6: Access tag
  const allFunded = outcomes.every(([, o]) => o.info.access === 'funded');
  const anyVPN    = outcomes.some(([, o]) => o.info.access === 'vpn');
  const accessTag = allFunded ? '✅ YOUR BOOKS' : anyVPN ? '🌐 VPN NEEDED' : '🇳🇬 NG ACCESS';

  // Step 7: Stakes (Dutching)
  const arbOutcomes: ArbOutcome[] = outcomes.map(([name, o]) => {
    const stake = parseFloat(((1 / o.odds / arbFraction) * STAKE).toFixed(2));
    return {
      outcome:         name,
      odds:            o.odds,
      bookmaker:       o.info.name,
      bookmakerKey:    o.key,
      url:             o.info.url,
      deposit:         o.info.deposit,
      access:          o.info.access,
      isFunded:        o.info.access === 'funded',
      isPinnacle:      isPinnacle(o.key),
      impliedProb:     parseFloat(((1 / o.odds) * 100).toFixed(2)),
      stake,
      stakeRounded:    Math.round(stake),
      potentialReturn: parseFloat((stake * o.odds).toFixed(2)),
    };
  });

  const { tier, label, warnings } = classifyTier(arbPct, genuine, hasPinnacle);

  return [{
    id:             `arb_${event.id}_${Date.now()}`,
    match:          `${event.home_team} vs ${event.away_team}`,
    sport:          event.sport_title,
    commenceTime:   event.commence_time,
    arbPercentage:  arbPct,
    profit:         genuine ? parseFloat((STAKE * arbPct / 100).toFixed(2)) : 0,
    isGenuineArb:   genuine,
    tier,
    tierLabel:      label,
    confidence,
    hasPinnacle,
    pinnacleIsBase,
    accessTag,
    bookmakerCount: focusedBooks.length,
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
    if (a.hasPinnacle !== b.hasPinnacle) return a.hasPinnacle ? -1 : 1; // Pinnacle first
    return b.arbPercentage - a.arbPercentage;
  });
}
