/**
 * SureEdge AI — Arbitrage Detection Engine v2
 * 
 * Professional arb detection with:
 * - Confidence tiers based on arb %
 * - False positive filtering
 * - Quality scoring
 * - Stake calculation with rounding
 * - Validation warnings
 */

import {
  canonicalName, getAccessLevel, getBookmakerUrl,
  getDepositMethod, isFunded, qualityScore, AccessLevel,
} from './normalizer';

export interface ArbOutcome {
  outcome: string;
  odds: number;
  bookmaker: string;
  bookmakerSlug: string;
  bookmakerUrl: string;
  depositMethod: string;
  access: AccessLevel;
  isFunded: boolean;
  impliedProb: number;
  stake: number;
  stakeRounded: number;
  potentialReturn: number;
}

export type ArbTier = 'EXECUTE' | 'VERIFY' | 'SUSPICIOUS' | 'NEAR_ARB';

export interface DetectedArb {
  id: string;
  match: string;
  sport: string;
  league: string;
  commenceTime: string;
  arbPercentage: number;
  guaranteedProfit: number;
  isGenuineArb: boolean;
  tier: ArbTier;
  tierLabel: string;
  confidence: number;
  qualityScore: number;
  accessTag: string;
  bothFunded: boolean;
  hasPinnacle: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  bookmakerCount: number;
  warnings: string[];
  outcomes: ArbOutcome[];
  expiresAt: string;
  detectedAt: string;
}

const TOTAL_STAKE = 10;

// Classify arb into actionability tiers
function classifyArb(arbPct: number, isGenuine: boolean, bookmakerCount: number, hasPinnacle: boolean): { tier: ArbTier; tierLabel: string; warnings: string[] } {
  const warnings: string[] = [];

  if (!isGenuine) {
    return { tier: 'NEAR_ARB', tierLabel: 'Near-arb — monitor for flip', warnings };
  }

  if (arbPct > 15) {
    warnings.push('Arb above 15% — likely stale/incorrect odds');
    warnings.push('VERIFY on live bookmaker sites before betting');
    warnings.push('One or both odds may have already corrected');
    return { tier: 'SUSPICIOUS', tierLabel: 'VERIFY FIRST — likely data error', warnings };
  }

  if (arbPct > 8) {
    warnings.push('High arb % — verify odds are still live');
    warnings.push('Check bookmaker sites directly before placing');
    if (bookmakerCount < 10) warnings.push('Low bookmaker coverage — less reliable');
    return { tier: 'VERIFY', tierLabel: 'Verify odds are live, then execute', warnings };
  }

  // 0-8% — sweet spot for real arbs
  if (hasPinnacle) {
    warnings.push('Pinnacle involved — high reliability');
  }
  if (bookmakerCount > 20) {
    warnings.push('Strong market coverage — odds likely accurate');
  }
  return { tier: 'EXECUTE', tierLabel: 'ACT NOW — verified range', warnings };
}

export function detectArbitrage(event: {
  id: string;
  sport_title: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: {
    key: string;
    title: string;
    markets: { key: string; outcomes: { name: string; price: number }[] }[];
  }[];
}, minArbPct: number = 0): DetectedArb[] {
  if (event.bookmakers.length < 2) return [];

  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};

  for (const bm of event.bookmakers) {
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const o of market.outcomes) {
      if (o.price <= 1.01) continue;
      if (o.price > 50) continue; // Filter obvious errors
      if (!bestOdds[o.name] || o.price > bestOdds[o.name].odds) {
        bestOdds[o.name] = { odds: o.price, key: bm.key, title: bm.title };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  // Check for duplicate bookmaker (same book on both sides = not a real arb)
  const uniqueBooks = new Set(outcomes.map(([, o]) => o.key.toLowerCase()));
  if (uniqueBooks.size < outcomes.length) return [];

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction >= 1.05) return [];
  if (arbPct < minArbPct && arbFraction >= 1.0) return [];

  const isGenuine = arbFraction < 1.0;
  const bookSlugs = outcomes.map(([, o]) => o.key.toLowerCase());
  const allFunded = bookSlugs.every(s => isFunded(s));
  const allNG = bookSlugs.every(s => getAccessLevel(s) !== 'vpn');
  const hasPinnacle = bookSlugs.some(s => s === 'pinnacle');
  const accessTag = allFunded ? '\u2705 YOUR BOOKS' : allNG ? '\u{1F1F3}\u{1F1EC} NG ACCESS' : '\u{1F310} VPN';

  // Calculate stakes
  const arbOutcomes: ArbOutcome[] = outcomes.map(([name, o]) => {
    const stake = parseFloat(((1 / o.odds / arbFraction) * TOTAL_STAKE).toFixed(2));
    return {
      outcome:         name,
      odds:            o.odds,
      bookmaker:       canonicalName(o.key),
      bookmakerSlug:   o.key.toLowerCase(),
      bookmakerUrl:    getBookmakerUrl(o.key),
      depositMethod:   getDepositMethod(o.key),
      access:          getAccessLevel(o.key),
      isFunded:        isFunded(o.key),
      impliedProb:     parseFloat(((1 / o.odds) * 100).toFixed(2)),
      stake,
      stakeRounded:    Math.round(stake),
      potentialReturn: parseFloat((stake * o.odds).toFixed(2)),
    };
  });

  // Classify tier
  const { tier, tierLabel, warnings } = classifyArb(arbPct, isGenuine, event.bookmakers.length, hasPinnacle);

  // Confidence scoring
  let confidence = 50;
  if (hasPinnacle) confidence += 25;
  if (allFunded) confidence += 10;
  if (event.bookmakers.length > 20) confidence += 10;
  if (event.bookmakers.length > 40) confidence += 5;
  if (tier === 'SUSPICIOUS') confidence -= 30;
  if (tier === 'VERIFY') confidence -= 10;
  confidence = Math.max(10, Math.min(100, confidence));

  const qScore = qualityScore(arbPct, bookSlugs);
  const guaranteedProfit = isGenuine ? parseFloat((TOTAL_STAKE * arbPct / 100).toFixed(2)) : 0;

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (tier === 'EXECUTE' && isGenuine) riskLevel = 'LOW';
  else if (tier === 'SUSPICIOUS') riskLevel = 'HIGH';

  return [{
    id:              `arb_${event.id}_${Date.now()}`,
    match:           `${event.home_team} vs ${event.away_team}`,
    sport:           event.sport_title,
    league:          event.sport_title,
    commenceTime:    event.commence_time,
    arbPercentage:   arbPct,
    guaranteedProfit,
    isGenuineArb:    isGenuine,
    tier,
    tierLabel,
    confidence,
    qualityScore:    qScore,
    accessTag,
    bothFunded:      allFunded,
    hasPinnacle,
    riskLevel,
    bookmakerCount:  event.bookmakers.length,
    warnings,
    outcomes:        arbOutcomes,
    expiresAt:       new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    detectedAt:      new Date().toISOString(),
  }];
}

export function sortArbs(arbs: DetectedArb[]): DetectedArb[] {
  return [...arbs].sort((a, b) => {
    // EXECUTE tier first
    const tierOrder: Record<ArbTier, number> = { EXECUTE: 0, VERIFY: 1, SUSPICIOUS: 2, NEAR_ARB: 3 };
    if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
    // Then by quality score
    return b.qualityScore - a.qualityScore;
  });
}
