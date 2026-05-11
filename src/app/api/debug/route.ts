export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const oioKey = process.env.ODDS_API_IO_KEY;
  if (!oioKey) return error('ODDS_API_IO_KEY not set', 500);

  const sports = ['football', 'basketball', 'baseball', 'ice-hockey', 'tennis', 'mma'];
  const results: Record<string, unknown> = {};

  for (const sport of sports) {
    const r = await fetch(
      `https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=${sport}&status=upcoming&limit=5`,
      { cache: 'no-store' }
    ).catch(() => null);
    if (!r) continue;

    const data = await r.json().catch(() => []) as Record<string, unknown>[];
    const count = Array.isArray(data) ? data.length : 0;
    if (count === 0) { results[sport] = 0; continue; }

    // Test odds on first event
    const first = data[0];
    const eventId = String(first.id ?? '');
    const oddsR = await fetch(
      `https://api.odds-api.io/v3/odds?apiKey=${oioKey}&eventId=${eventId}&market=moneyline&bookmakers=1xbet,Bet365,Betfair Exchange,22Bet,Betway,Bet9ja,SportyBet`,
      { cache: 'no-store' }
    ).catch(() => null);

    const oddsData = oddsR ? await oddsR.json().catch(() => []) as Record<string, unknown>[] : [];
    const books = Array.isArray(oddsData) 
      ? [...new Set(oddsData.map(o => String(o.bookmaker ?? '')))] .filter(Boolean)
      : [];

    results[sport] = {
      events: count,
      sample: `${first.home} vs ${first.away} (${String(first.date ?? '').slice(0, 10)})`,
      books_returning_odds: books,
      arb_potential: books.length >= 2 ? '✅ Can detect arbs' : '⚠️ Need more books',
    };
  }

  return success({
    timestamp: new Date().toISOString(),
    note: 'OddsPapi resets June 1 — will add Pinnacle. Until then: 1xBet+Betfair+Bet365 arbs via odds-api.io',
    sports_with_events: results,
  });
}
