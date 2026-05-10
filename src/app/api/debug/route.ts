export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const results: Record<string, unknown> = {};

  // 1. Pinnacle Direct
  const pinnUser = process.env.PINNACLE_USERNAME;
  const pinnPass = process.env.PINNACLE_PASSWORD;
  if (pinnUser && pinnPass) {
    try {
      const creds = Buffer.from(`${pinnUser}:${pinnPass}`).toString('base64');
      const r = await fetch('https://api.pinnacle.com/v1/sports', {
        headers: { 'Authorization': `Basic ${creds}`, 'Accept': 'application/json' },
      });
      const body = await r.text();
      results.pinnacle_direct = { status: r.status, sample: body.slice(0, 200) };
    } catch (e) { results.pinnacle_direct = `error: ${e}`; }
  } else { results.pinnacle_direct = 'PINNACLE_USERNAME or PINNACLE_PASSWORD not set'; }

  // 2. odds-api.io
  const oioKey = process.env.ODDS_API_IO_KEY;
  if (oioKey) {
    try {
      const r = await fetch(`https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=basketball&status=upcoming&limit=2`);
      const body = await r.text();
      results.odds_api_io = { status: r.status, sample: body.slice(0, 200) };
    } catch (e) { results.odds_api_io = `error: ${e}`; }
  } else { results.odds_api_io = 'ODDS_API_IO_KEY not set'; }

  // 3. OddsPapi
  const papiKey = process.env.ODDSPAPI_API_KEY;
  if (papiKey) {
    try {
      const r = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${papiKey}`);
      const d = await r.json();
      const sub = d.subscriptions?.[0];
      results.oddspapi = { status: r.status, used: `${sub?.request_count}/${sub?.request_limit}`, resets: 'June 1' };
    } catch (e) { results.oddspapi = `error: ${e}`; }
  } else { results.oddspapi = 'ODDSPAPI_API_KEY not set'; }

  // 4. The Odds API
  const oddsKey = process.env.ODDS_API_KEY;
  if (oddsKey) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${oddsKey}`);
      results.the_odds_api = { status: r.status, remaining: r.headers.get('x-requests-remaining') };
    } catch (e) { results.the_odds_api = `error: ${e}`; }
  } else { results.the_odds_api = 'ODDS_API_KEY not set'; }

  return success({
    timestamp: new Date().toISOString(),
    env: {
      PINNACLE_USERNAME:  pinnUser  ? 'set' : 'NOT SET — add your Pinnacle login',
      PINNACLE_PASSWORD:  pinnPass  ? 'set' : 'NOT SET — add your Pinnacle password',
      ODDS_API_IO_KEY:    oioKey    ? `set (${oioKey.slice(0, 8)}...)` : 'NOT SET',
      ODDSPAPI_API_KEY:   papiKey   ? `set (${papiKey.slice(0, 8)}...)` : 'NOT SET',
      ODDS_API_KEY:       oddsKey   ? 'set' : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   ? 'set' : 'NOT SET',
    },
    apis: results,
    action_needed: pinnUser ? 'All configured' : 'Add PINNACLE_USERNAME and PINNACLE_PASSWORD to Vercel env vars',
  });
}
