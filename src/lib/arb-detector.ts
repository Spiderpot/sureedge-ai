/**
 * SureEdge AI — Arbitrage Detection Engine
 * 
 * Professional arb detection:
 * - Compares ALL bookmakers simultaneously (not pairwise)
 * - Quality scoring based on reliability + accessibility
 * - Confidence rating per arb
 * - Stake optimization using Dutching formula
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
  stake: number;         // For $10 total
  potentialReturn: number;
}

export interface DetectedArb {
  id: string;
  match: string;
  sport: string;
  league: string;
  commenceTime: string;
  arbPercentage: number;
  guaranteedProfit: number;  // In dollars for $10 stake
  isGenuineArb: boolean;
  confidence: number;        // 0-100
  qualityScore: number;
  accessTag: string;
  bothFunded: boolean;
  hasPinnacle: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  bookmakerCount: number;
  outcomes: ArbOutcome[];
  expiresAt: string;
  detectedAt: string;
}

interface RawEvent {
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
}

const TOTAL_STAKE = 10; // Default stake for calculations

export function detectArbitrage(event: RawEvent, minArbPct: number = 0): DetectedArb[] {
  if (event.bookmakers.length < 2) return [];

  // Step 1: Find BEST odds per outcome across ALL bookmakers
  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  
  for (const bm of event.bookmakers) {
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const o of market.outcomes) {
      if (o.price <= 1.01) continue; // Filter garbage
      if (!bestOdds[o.name] || o.price > bestOdds[o.name].odds) {
        bestOdds[o.name] = { odds: o.price, key: bm.key, title: bm.title };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  // Step 2: Calculate arbitrage
  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  // Step 3: Apply threshold (show up to 5% overround for near-arbs)
  if (arbFraction >= 1.05) return [];
  if (arbPct < minArbPct && arbFraction >= 1.0) return [];

  // Step 4: Calculate stakes using Dutching formula
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
      potentialReturn: parseFloat((stake * o.odds).toFixed(2)),
    };
  });

  // Step 5: Determine access tag
  const allFunded = arbOutcomes.every(o => o.isFunded);
  const allNG     = arbOutcomes.every(o => o.access !== 'vpn');
  const accessTag = allFunded ? '✅ YOUR BOOKS' : allNG ? '🇳🇬 NG ACCESS' : '🌐 VPN';

  // Step 6: Quality and confidence scoring
  const bookSlugs = arbOutcomes.map(o => o.bookmakerSlug);
  const qScore = qualityScore(arbPct, bookSlugs);
  const hasPinnacle = bookSlugs.some(s => s === 'pinnacle');
  
  // Confidence: Pinnacle involvement = high confidence (sharpest odds)
  let confidence = 50;
  if (hasPinnacle) confidence += 30;
  if (allFunded) confidence += 15;
  if (arbPct > 3) confidence += 5;
  if (event.bookmakers.length > 10) confidence += 5; // More books = more reliable
  confidence = Math.min(confidence, 100);

  // Step 7: Risk assessment
  const isGenuine = arbFraction < 1.0;
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (isGenuine && hasPinnacle && confidence > 70) riskLevel = 'LOW';
  else if (isGenuine) riskLevel = 'LOW';
  else if (arbPct > -1) riskLevel = 'MEDIUM';
  else riskLevel = 'HIGH';

  const guaranteedProfit = isGenuine
    ? parseFloat((TOTAL_STAKE * arbPct / 100).toFixed(2))
    : 0;

  return [{
    id:              `arb_${event.id}_${Date.now()}`,
    match:           `${event.home_team} vs ${event.away_team}`,
    sport:           event.sport_title,
    league:          event.sport_title,
    commenceTime:    event.commence_time,
    arbPercentage:   arbPct,
    guaranteedProfit,
    isGenuineArb:    isGenuine,
    confidence,
    qualityScore:    qScore,
    accessTag,
    bothFunded:      allFunded,
    hasPinnacle,
    riskLevel,
    bookmakerCount:  event.bookmakers.length,
    outcomes:        arbOutcomes,
    expiresAt:       new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    detectedAt:      new Date().toISOString(),
  }];
}

// Sort arbs by priority: quality score (funded + pinnacle first), then arb %
export function sortArbs(arbs: DetectedArb[]): DetectedArb[] {
  return [...arbs].sort((a, b) => {
    // Genuine arbs always first
    if (a.isGenuineArb !== b.isGenuineArb) return a.isGenuineArb ? -1 : 1;
    // Then by quality score
    return b.qualityScore - a.qualityScore;
  });
}
