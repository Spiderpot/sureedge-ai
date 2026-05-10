export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const results: Record<string, unknown> = {};

  // 1. OddsPapi status
  const papiKey = process.env.ODDSPAPI_API_KEY;
  if (papiKey) {
    try {
      const r = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${papiKey}`);
      const d = await r.json();
      const sub = d.subscriptions?.[0];
      results.oddspapi = { status: r.status, used: `${sub?.request_count}/${sub?.request_limit}`, plan: sub?.plan, resets: 'June 1' };
    } catch (e) { results.oddspapi = `error: ${e}`; }
  } else { results.oddspapi = 'NOT SET'; }

  // 2. odds-api.io — fetch real basketball odds and check bookmakers
  const oioKey = process.env.ODDS_API_IO_KEY;
  if (oioKey) {
    try {
      // Get events
      const evRes = await fetch(`https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=basketball&limit=3`);
      const evData = await evRes.json() as Record<string, unknown>;
      const events = (Array.isArray(evData) ? evData : (evData.data ?? evData.events ?? [])) as Record<string, unknown>[];

      if (events.length > 0) {
        const firstEvent = events[0];
        const eventId = String(firstEvent.id ?? firstEvent.eventId ?? '');
        
        // Get odds for first event
        const oddsRes = await fetch(`https://api.odds-api.io/v3/odds?apiKey=${oioKey}&eventId=${eventId}&market=moneyline`);
        const oddsData = await oddsRes.json() as Record<string, unknown>;
        const oddsItems = (Array.isArray(oddsData) ? oddsData : (oddsData.data ?? oddsData.odds ?? [])) as Record<string, unknown>[];
        
        // Extract unique bookmaker names
        const bookmakers = [...new Set(oddsItems.map(o => String(o.bookmaker ?? o.sportsbook ?? '')))].filter(Boolean);
        const hasPinnacle = bookmakers.some(b => b.toLowerCase().includes('pinnacle'));
        const has1xBet    = bookmakers.some(b => b.toLowerCase().includes('1xbet') || b.toLowerCase().includes('1x'));
        const hasBetfair  = bookmakers.some(b => b.toLowerCase().includes('betfair'));
        const hasBet365   = bookmakers.some(b => b.toLowerCase().includes('bet365'));

        results.odds_api_io = {
          status:        evRes.status,
          events_found:  events.length,
          event_sample:  `${firstEvent.homeTeam ?? firstEvent.home_team} vs ${firstEvent.awayTeam ?? firstEvent.away_team}`,
          bookmakers_count: bookmakers.length,
          bookmakers_sample: bookmakers.slice(0, 20),
          has_pinnacle:  hasPinnacle,
          has_1xbet:     has1xBet,
          has_betfair:   hasBetfair,
          has_bet365:    hasBet365,
          verdict: hasPinnacle ? '✅ HAS PINNACLE — excellent for arbs' : '⚠️ No Pinnacle — soft books only',
        };
      } else {
        results.odds_api_io = { status: evRes.status, events_found: 0, note: 'No events right now' };
      }
    } catch (e) { results.odds_api_io = `error: ${e}`; }
  } else { results.odds_api_io = 'NOT SET'; }

  // 3. The Odds API status
  const oddsKey = process.env.ODDS_API_KEY;
  if (oddsKey) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${oddsKey}`);
      results.the_odds_api = { status: r.status, remaining: r.headers.get('x-requests-remaining'), resets: 'June 1' };
    } catch (e) { results.the_odds_api = `error: ${e}`; }
  } else { results.the_odds_api = 'NOT SET'; }

  return success({
    timestamp: new Date().toISOString(),
    env: {
      ODDSPAPI_API_KEY: papiKey  ? `set (${papiKey.slice(0, 8)}...)`  : 'NOT SET',
      ODDS_API_IO_KEY:  oioKey   ? `set (${oioKey.slice(0, 8)}...)`   : 'NOT SET',
      ODDS_API_KEY:     oddsKey  ? 'set' : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   ? 'set' : 'NOT SET',
    },
    apis: results,
  });
}
