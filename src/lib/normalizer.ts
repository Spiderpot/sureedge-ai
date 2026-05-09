/**
 * SureEdge AI — Odds Normalization Engine
 * 
 * Converts raw bookmaker data from any source into a unified format.
 * Handles: name variations, odds formats, outcome mapping.
 */

// Canonical bookmaker names — maps API slugs to display names
const BOOKMAKER_NAMES: Record<string, string> = {
  // Sharp
  'pinnacle': 'Pinnacle', 'ps3838': 'Pinnacle',
  // Nigerian
  '1xbet': '1xBet', 'onexbet': '1xBet', '22bet': '22Bet',
  'bet9ja': 'Bet9ja', 'sportybet': 'SportyBet', 'betway': 'Betway',
  'msport': 'MSport', 'melbet': 'MelBet', 'betwinner': 'BetWinner',
  // European soft
  'tipico': 'Tipico', 'betfair': 'Betfair', 'betfair-ex': 'Betfair Exchange',
  'bet365': 'Bet365', 'williamhill': 'William Hill', 'unibet': 'Unibet',
  'ladbrokes': 'Ladbrokes', 'paddypower': 'Paddy Power', 'betsson': 'Betsson',
  'bwin': 'Bwin', 'interwetten': 'Interwetten', 'betvictor': 'BetVictor',
  // US soft
  'draftkings': 'DraftKings', 'fanduel': 'FanDuel', 'betmgm': 'BetMGM',
  'caesars': 'Caesars', 'betrivers': 'BetRivers',
  // AU
  'tab.com.au': 'TAB', 'pointsbet.com.au': 'PointsBet', 'sportsbet': 'Sportsbet',
  // Crypto
  'bovada': 'Bovada', 'betonlineag': 'BetOnline', 'mybookieag': 'MyBookie',
  'cloudbet': 'Cloudbet', 'stake': 'Stake',
  // Exchange
  'matchbook': 'Matchbook', 'smarkets': 'Smarkets',
  'sport888': '888sport', 'marathonbet': 'MarathonBet',
};

export function canonicalName(slug: string): string {
  return BOOKMAKER_NAMES[slug.toLowerCase()] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Bookmaker access from Nigeria
export type AccessLevel = 'funded' | 'ng' | 'vpn';

const FUNDED_BOOKS = new Set(['pinnacle', '1xbet', 'onexbet', '22bet']);
const NG_BOOKS = new Set([
  'pinnacle', '1xbet', 'onexbet', '22bet', 'betway', 'bet9ja',
  'sportybet', 'msport', 'melbet', 'betwinner', 'marathonbet',
  'betonlineag', 'bovada', 'mybookieag', 'betus', 'sport888',
  'cloudbet', 'stake',
]);

export function getAccessLevel(slug: string): AccessLevel {
  const key = slug.toLowerCase();
  if (FUNDED_BOOKS.has(key)) return 'funded';
  if (NG_BOOKS.has(key)) return 'ng';
  return 'vpn';
}

export function isFunded(slug: string): boolean {
  return FUNDED_BOOKS.has(slug.toLowerCase());
}

export function addFundedBook(slug: string) {
  FUNDED_BOOKS.add(slug.toLowerCase());
}

// Bookmaker URLs
const BOOKMAKER_URLS: Record<string, string> = {
  'pinnacle': 'https://pinnacle.com', '1xbet': 'https://1xbet.ng',
  'onexbet': 'https://1xbet.ng', '22bet': 'https://22bet.ng',
  'bet9ja': 'https://bet9ja.com', 'sportybet': 'https://sportybet.com',
  'betway': 'https://betway.com.ng', 'msport': 'https://msport.com',
  'melbet': 'https://melbet.com', 'betwinner': 'https://betwinner.com',
  'tipico': 'https://tipico.de', 'betfair': 'https://betfair.com',
  'betfair-ex': 'https://betfair.com/exchange',
  'bet365': 'https://bet365.com', 'williamhill': 'https://williamhill.com',
  'draftkings': 'https://draftkings.com', 'fanduel': 'https://fanduel.com',
  'betmgm': 'https://betmgm.com', 'bovada': 'https://bovada.lv',
  'betonlineag': 'https://betonline.ag', 'mybookieag': 'https://mybookie.ag',
  'marathonbet': 'https://marathonbet.com', 'sport888': 'https://888sport.com',
  'cloudbet': 'https://cloudbet.com', 'stake': 'https://stake.com',
};

export function getBookmakerUrl(slug: string): string {
  return BOOKMAKER_URLS[slug.toLowerCase()] || '';
}

// Deposit methods
const DEPOSIT_METHODS: Record<string, string> = {
  'pinnacle': 'Crypto (USDT TRC-20)', '1xbet': 'Naira, bank, USSD',
  'onexbet': 'Naira, bank, USSD', '22bet': 'Naira, bank, crypto',
  'bet9ja': 'Naira, bank, USSD', 'sportybet': 'Naira, bank, USSD',
  'betway': 'Naira, bank, card', 'betfair': 'Skrill, crypto',
  'bet365': 'Skrill, crypto', 'tipico': 'Skrill',
  'bovada': 'Crypto (BTC/USDT)', 'betonlineag': 'Crypto (BTC/USDT)',
  'marathonbet': 'Crypto, e-wallets', 'sport888': 'E-wallets',
};

export function getDepositMethod(slug: string): string {
  return DEPOSIT_METHODS[slug.toLowerCase()] || '';
}

// Arb quality scoring — higher = better opportunity
export function qualityScore(arbPct: number, bookmakers: string[]): number {
  let score = arbPct * 10; // Base: arb percentage
  
  // Bonus for Pinnacle involvement (most reliable odds)
  if (bookmakers.some(b => b.toLowerCase() === 'pinnacle')) score += 20;
  
  // Bonus for funded bookmakers
  const fundedCount = bookmakers.filter(b => isFunded(b)).length;
  score += fundedCount * 15;
  
  // Bonus for NG accessible (can act immediately)
  const ngCount = bookmakers.filter(b => getAccessLevel(b) !== 'vpn').length;
  score += ngCount * 5;
  
  // Penalty for VPN-only (harder to execute)
  const vpnCount = bookmakers.filter(b => getAccessLevel(b) === 'vpn').length;
  score -= vpnCount * 3;
  
  return Math.round(score * 100) / 100;
}
