export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const oddsKey = process.env.ODDS_API_KEY;
  if (!oddsKey) return error('ODDS_API_KEY not set', 500);

  // Fetch NHL odds and show ALL bookmakers returned
  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds?` + new URLSearchParams({
      apiKey: oddsKey, regions: 'eu,uk', markets: 'h2h',
      oddsFormat: 'decimal', dateFormat: 'iso',
    }),
    { cache: 'no-store' }
  );

  const remaining = res.headers.get('x-requests-remaining');
  const data = await res.json() as Record<string, unknown>[];

  // Extract all bookmaker keys from all events
  const allBooks = new Set<string>();
  for (const ev of data) {
    for (const bm of (ev.bookmakers as Record<string, unknown>[] ?? [])) {
      allBooks.add(String(bm.key));
    }
  }

  // Check which ones match our focused books
  const focused = ['pinnacle', 'onexbet', '1xbet', 'bet365', '22bet', 'betfair_ex_eu'];
  const found = [...allBooks].filter(b => focused.includes(b));
  const missing = focused.filter(b => !allBooks.has(b));

  return success({
    credits_remaining: remaining,
    events: data.length,
    all_bookmakers_returned: [...allBooks].sort(),
    focused_books_found: found,
    focused_books_missing: missing,
    verdict: found.length >= 2 ? '✅ Enough focused books for arb detection' : '❌ Not enough focused books — filter too strict',
    first_event_sample: data[0] ? {
      match: `${data[0].home_team} vs ${data[0].away_team}`,
      bookmakers: (data[0].bookmakers as Record<string, unknown>[])?.map(b => b.key),
    } : null,
  });
}
