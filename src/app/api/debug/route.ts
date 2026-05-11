export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const results: Record<string, unknown> = {};

  // Check The Odds API bookmakers list (0 credits used - uses /sports not /odds)
  const oddsKey = process.env.ODDS_API_KEY;
  if (oddsKey) {
    try {
      // Check available bookmakers - costs 0 credits
      const r = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${oddsKey}`);
      const remaining = r.headers.get('x-requests-remaining');
      const used = r.headers.get('x-requests-used');

      // Also verify Pinnacle by checking their bookmakers endpoint
      const bmRes = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${oddsKey}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`);
      const bmRemaining = bmRes.headers.get('x-requests-remaining');

      if (bmRes.ok) {
        const data = await bmRes.json() as Record<string, unknown>[];
        const allBooks = new Set<string>();
        for (const ev of data.slice(0, 3)) {
          for (const bm of (ev.bookmakers as Record<string, unknown>[] ?? [])) {
            allBooks.add(String(bm.key));
          }
        }
        const hasPinnacle = [...allBooks].some(b => b.includes('pinnacle'));
        results.the_odds_api = {
          status: bmRes.status,
          credits_used: used,
          credits_remaining: bmRemaining,
          eu_bookmakers_found: [...allBooks],
          has_pinnacle: hasPinnacle,
          verdict: hasPinnacle ? '✅ PINNACLE CONFIRMED in EU region' : '❌ No Pinnacle in EU results',
        };
      } else {
        results.the_odds_api = { status: bmRes.status, remaining, note: 'Could not fetch odds' };
      }
    } catch (e) { results.the_odds_api = `error: ${e}`; }
  }

  // OddsPapi status
  const papiKey = process.env.ODDSPAPI_API_KEY;
  if (papiKey) {
    try {
      const r = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${papiKey}`);
      const d = await r.json();
      const sub = d.subscriptions?.[0];
      results.oddspapi = { used: `${sub?.request_count}/${sub?.request_limit}`, resets: 'June 1' };
    } catch (e) { results.oddspapi = `error: ${e}`; }
  }

  // odds-api.io status
  const oioKey = process.env.ODDS_API_IO_KEY;
  if (oioKey) {
    try {
      const r = await fetch(`https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=football&status=upcoming&limit=3`);
      const data = await r.json() as unknown[];
      results.odds_api_io = { status: r.status, events: Array.isArray(data) ? data.length : 0, resets: 'hourly' };
    } catch (e) { results.odds_api_io = `error: ${e}`; }
  }

  return success({
    timestamp: new Date().toISOString(),
    env: {
      ODDS_API_KEY:     oddsKey  ? 'set' : 'NOT SET',
      ODDSPAPI_API_KEY: papiKey  ? `set (${papiKey?.slice(0, 8)}...)` : 'NOT SET',
      ODDS_API_IO_KEY:  oioKey   ? `set (${oioKey?.slice(0, 8)}...)` : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
    },
    findings: results,
  });
}
