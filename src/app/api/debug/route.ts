export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const oioKey = process.env.ODDS_API_IO_KEY;
  if (!oioKey) return error('ODDS_API_IO_KEY not set', 500);

  // Get ALL bookmakers
  const bmRes = await fetch(`https://api.odds-api.io/v3/bookmakers?apiKey=${oioKey}`);
  const bmData = await bmRes.json() as { name: string; active: boolean }[];
  const active = bmData.filter(b => b.active).map(b => b.name);

  const hasPinnacle = active.some(b => b.toLowerCase().includes('pinnacle'));
  const hasBetfair  = active.some(b => b.toLowerCase().includes('betfair'));
  const hasBet365   = active.some(b => b.toLowerCase().includes('bet365'));
  const has1xBet    = active.some(b => b.toLowerCase().includes('1xbet'));
  const has22Bet    = active.some(b => b.toLowerCase().includes('22bet'));

  // Build our target bookmaker string for arbitrage calls
  const targetBooks = active.filter(b => {
    const l = b.toLowerCase();
    return l.includes('pinnacle') || l.includes('betfair') || l.includes('bet365') ||
           l.includes('1xbet') || l.includes('22bet') || l.includes('singbet') ||
           l.includes('unibet') || l.includes('williamhill') || l.includes('bwin') ||
           l.includes('marathonbet');
  });

  // Test arbitrage endpoint with our target books
  let arbTest: unknown = 'skipped';
  if (targetBooks.length >= 2) {
    const arbRes = await fetch(
      `https://api.odds-api.io/v3/arbitrage-bets?apiKey=${oioKey}&sport=football&bookmakers=${encodeURIComponent(targetBooks.slice(0,10).join(','))}`
    );
    const arbRaw = await arbRes.text();
    arbTest = { status: arbRes.status, raw: arbRaw.slice(0, 800) };
  }

  return success({
    timestamp: new Date().toISOString(),
    total_active_bookmakers: active.length,
    has_pinnacle: hasPinnacle,
    has_betfair:  hasBetfair,
    has_bet365:   hasBet365,
    has_1xbet:    has1xBet,
    has_22bet:    has22Bet,
    target_books_found: targetBooks,
    arbitrage_test: arbTest,
    all_active_bookmakers: active,
  });
}
