export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const results: Record<string, string> = {};

  // 1. OddsPapi
  const papiKey = process.env.ODDSPAPI_API_KEY;
  if (papiKey) {
    try {
      const r = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${papiKey}`);
      const d = await r.json();
      const sub = d.subscriptions?.[0];
      results.oddspapi = `${r.status} — used=${sub?.request_count}/${sub?.request_limit}, plan=${sub?.plan}, resets=monthly`;
    } catch (e) { results.oddspapi = `error: ${e}`; }
  } else { results.oddspapi = 'ODDSPAPI_API_KEY not set'; }

  // 2. odds-api.io v3 sports list
  const oioKey = process.env.ODDS_API_IO_KEY;
  if (oioKey) {
    try {
      const r = await fetch(`https://api.odds-api.io/v3/sports?apiKey=${oioKey}`);
      const body = await r.text();
      const parsed = body.startsWith('[') ? JSON.parse(body) : null;
      results.odds_api_io = `${r.status} — ${parsed ? `${parsed.length} sports available` : body.slice(0, 120)}`;
    } catch (e) { results.odds_api_io = `error: ${e}`; }
  } else { results.odds_api_io = 'ODDS_API_IO_KEY not set'; }

  // 3. The Odds API
  const oddsKey = process.env.ODDS_API_KEY;
  if (oddsKey) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${oddsKey}`);
      const remaining = r.headers.get('x-requests-remaining');
      const used = r.headers.get('x-requests-used');
      results.the_odds_api = `${r.status} — used=${used}, remaining=${remaining}`;
    } catch (e) { results.the_odds_api = `error: ${e}`; }
  } else { results.the_odds_api = 'ODDS_API_KEY not set'; }

  return success({
    timestamp: new Date().toISOString(),
    env: {
      ODDSPAPI_API_KEY:   papiKey  ? `set (${papiKey.slice(0, 8)}...)`  : 'NOT SET',
      ODDS_API_IO_KEY:    oioKey   ? `set (${oioKey.slice(0, 8)}...)`   : 'NOT SET',
      ODDS_API_KEY:       oddsKey  ? 'set'                               : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   ? 'set' : 'NOT SET',
      CRON_SECRET:        process.env.CRON_SECRET         ? 'set' : 'NOT SET',
      // Removed: SHARP_API_KEY — SharpAPI only covers 2 US books on free tier
    },
    apis: results,
    notes: {
      oddspapi:    'Pinnacle + 1xBet + Betfair + Bet365 + 350 more. 250 req/month. Resets June 1.',
      odds_api_io: '265+ bookmakers. 100 req/HOUR (resets hourly). Testing Pinnacle coverage.',
      the_odds_api:'Betfair + Bet365 only. No Pinnacle/1xBet. 500/month. Resets June 1.',
    },
  });
}
