/**
 * SureEdge AI — Bookmaker Registry
 * 
 * Four focused bookmakers. Role-based comparison.
 * Pinnacle = sharp reference. Others = comparison targets.
 */

export type BookmakerRole = 'SHARP' | 'SOFT';
export type AccessLevel   = 'funded' | 'ng' | 'vpn';

export interface BookmakerInfo {
  name:       string;
  role:       BookmakerRole;
  access:     AccessLevel;
  url:        string;
  deposit:    string;
  apiSlugs:   string[];  // All known API slug variations
}

// ─── Four focused bookmakers ─────────────────────────────────────────────

export const BOOKMAKERS: Record<string, BookmakerInfo> = {
  pinnacle: {
    name:     'Pinnacle',
    role:     'SHARP',
    access:   'funded',
    url:      'https://pinnacle.com',
    deposit:  'Crypto (USDT TRC-20)',
    apiSlugs: ['pinnacle', 'pinnacle sports', 'pinnaclesports', 'ps3838'],
  },
  bet365: {
    name:     'Bet365',
    role:     'SOFT',
    access:   'vpn',
    url:      'https://bet365.com',
    deposit:  'Skrill, Neteller, crypto',
    apiSlugs: ['bet365', 'bet365 nj', 'bet365.de'],
  },
  '1xbet': {
    name:     '1xBet',
    role:     'SOFT',
    access:   'funded',
    url:      'https://1xbet.ng',
    deposit:  'Naira, bank transfer, USSD',
    apiSlugs: ['1xbet', 'onexbet', 'onexbet_ng', '1x bet', '1xbet ng', '1xbet.ng'],
  },
  '22bet': {
    name:     '22Bet',
    role:     'SOFT',
    access:   'funded',
    url:      'https://22bet.ng',
    deposit:  'Naira, bank transfer, crypto',
    apiSlugs: ['22bet', '22 bet', '22bet ng'],
  },
  betfair: {
    name:     'Betfair',
    role:     'SOFT',
    access:   'vpn',
    url:      'https://betfair.com',
    deposit:  'Skrill, Neteller',
    apiSlugs: ['betfair', 'betfair_ex_eu', 'betfair_ex_uk', 'betfair_ex_us', 'betfair_ex', 'betfair exchange', 'betfair_sb_uk', 'betfairsportsbook'],
  },
};

// ─── Slug → canonical key ────────────────────────────────────────────────

const SLUG_MAP: Record<string, string> = {};
for (const [key, bm] of Object.entries(BOOKMAKERS)) {
  for (const slug of bm.apiSlugs) {
    SLUG_MAP[slug.toLowerCase().replace(/\s+/g, '')] = key;
  }
}

export function resolveBookmaker(apiSlug: string): BookmakerInfo | null {
  const clean = apiSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key   = SLUG_MAP[clean];
  return key ? BOOKMAKERS[key] : null;
}

export function isPinnacle(apiSlug: string): boolean {
  const bm = resolveBookmaker(apiSlug);
  return bm?.role === 'SHARP';
}

export function isFocusedBook(apiSlug: string): boolean {
  return resolveBookmaker(apiSlug) !== null;
}
