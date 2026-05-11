export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const oioKey = process.env.ODDS_API_IO_KEY;
  const results: Record<string, unknown> = {};

  if (!oioKey) return error('ODDS_API_IO_KEY not set', 500);

  // Test all sports to find which have live events NOW
  const sports = ['football', 'basketball', 'baseball', 'ice-hockey', 'tennis', 'mma'];
  
  for (const sport of sports) {
    try {
      const r = await fetch(
        `https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=${sport}&status=upcoming&limit=3`,
        { cache: 'no-store' }
      );
      const data = await r.json() as unknown[];
      const count = Array.isArray(data) ? data.length : 0;
      
      if (count > 0) {
        const first = data[0] as Record<string, unknown>;
        // Also test odds for first event
        const eventId = String(first.id ?? '');
        const oddsR = await fetch(
          `https://api.odds-api.io/v3/odds?apiKey=${oioKey}&eventId=${eventId}&market=moneyline&bookmakers=1xbet,Bet365,Betfair Exchange,22Bet,Betway`,
          { cache: 'no-store' }
        );
        const oddsData = await oddsR.json() as unknown[];
        const booksFound = Array.isArray(oddsData)
          ? [...new Set(oddsData.map((o: unknown) => (o as Record<string, unknown>).bookmaker as string))].filter(Boolean)
          : [];

        results[sport] = {
          events: count,
          sample: `${first.home} vs ${first.away}`,
          date: first.date,
          bookmakers_found: booksFound,
          has_1xbet: booksFound.some(b => String(b).toLowerCase().includes('1xbet')),
          has_betfair: booksFound.some(b => String(b).toLowerCase().includes('betfair')),
          has_bet365: booksFound.some(b => String(b).toLowerCase().includes('bet365')),
        };
      } else {
        results[sport] = { events: 0 };
      }
    } catch (e) {
      results[sport] = `error: ${e}`;
    }
  }

  return success({
    timestamp: new Date().toISOString(),
    pinnacle_status: '451 BLOCKED — Vercel/Nigeria geo-restricted. Using OddsPapi when it resets June 1.',
    odds_api_io_sports: results,
  });
}
