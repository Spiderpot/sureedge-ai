export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) return error('Unauthorized', 401);

  const results: Record<string, string> = {};

  // Test OddsPapi
  const papiKey = process.env.ODDSPAPI_API_KEY;
  if (papiKey) {
    try {
      const r = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${papiKey}`);
      const d = await r.json();
      const sub = d.subscriptions?.[0];
      results.oddspapi = `${r.status} — used=${sub?.request_count}/${sub?.request_limit}, resets monthly`;
    } catch (e) { results.oddspapi = `error: ${e}`; }
  } else { results.oddspapi = 'NOT SET'; }

  // Test odds-api.io v3
  const oioKey = process.env.ODDS_API_IO_KEY;
  if (oioKey) {
    try {
      const r = await fetch(`https://api.odds-api.io/v3/sports?apiKey=${oioKey}`);
      const body = await r.text();
      results.odds_api_io = `${r.status} — ${body.slice(0, 100)}`;
    } catch (e) { results.odds_api_io = `error: ${e}`; }
  } else { results.odds_api_io = 'NOT SET'; }

  // Test SharpAPI
  const sharpKey = process.env.SHARP_API_KEY;
  if (sharpKey) {
    try {
      const r = await fetch(`https://api.sharpapi.io/api/v1/sports`, {
        headers: { 'Authorization': `Bearer ${sharpKey}`, 'Accept': 'application/json' },
      });
      const body = await r.text();
      results.sharpapi = `${r.status} — ${body.slice(0, 100)}`;
    } catch (e) { results.sharpapi = `error: ${e}`; }
  } else { results.sharpapi = 'NOT SET'; }

  // Test The Odds API
  const oddsKey = process.env.ODDS_API_KEY;
  if (oddsKey) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${oddsKey}`);
      const remaining = r.headers.get('x-requests-remaining');
      results.the_odds_api = `${r.status} — remaining: ${remaining ?? 'unknown'}`;
    } catch (e) { results.the_odds_api = `error: ${e}`; }
  } else { results.the_odds_api = 'NOT SET'; }

  return success({
    timestamp: new Date().toISOString(),
    env: {
      ODDSPAPI_API_KEY:   papiKey  ? `set (${papiKey.slice(0, 8)}...)`  : 'NOT SET',
      ODDS_API_IO_KEY:    oioKey   ? `set (${oioKey.slice(0, 8)}...)`   : 'NOT SET',
      SHARP_API_KEY:      sharpKey ? `set (${sharpKey.slice(0, 8)}...)` : 'NOT SET',
      ODDS_API_KEY:       oddsKey  ? 'set' : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   ? 'set' : 'NOT SET',
    },
    apis: results,
  });
}
