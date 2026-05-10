export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) return error('Unauthorized', 401);

  // Test OddsPapi account status
  const papiKey = process.env.ODDSPAPI_API_KEY;
  let papiStatus = 'not configured';
  if (papiKey) {
    try {
      const r = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${papiKey}`);
      const d = await r.json();
      const sub = d.subscriptions?.[0];
      papiStatus = `${r.status} — used=${sub?.request_count}/${sub?.request_limit}, plan=${sub?.plan}`;
    } catch (e) { papiStatus = `error: ${e}`; }
  }

  // Test odds-api.io
  const oioKey = process.env.ODDS_API_IO_KEY;
  let oioStatus = 'not configured';
  if (oioKey) {
    try {
      const r = await fetch(`https://api.odds-api.io/v1/sports?apiKey=${oioKey}`);
      oioStatus = `${r.status} ${r.statusText}`;
    } catch (e) { oioStatus = `error: ${e}`; }
  }

  // Test SharpAPI
  const sharpKey = process.env.SHARP_API_KEY;
  let sharpStatus = 'not configured';
  if (sharpKey) {
    try {
      const r = await fetch(`https://sharpapi.io/api/v1/sport/basketball/nba/odds`, {
        headers: { 'Authorization': `Bearer ${sharpKey}` }
      });
      sharpStatus = `${r.status} ${r.statusText}`;
    } catch (e) { sharpStatus = `error: ${e}`; }
  }

  return success({
    timestamp: new Date().toISOString(),
    env: {
      ODDSPAPI_API_KEY: papiKey ? `set (${papiKey.slice(0, 8)}...)` : 'NOT SET',
      ODDS_API_IO_KEY:  oioKey  ? `set (${oioKey.slice(0, 8)}...)`  : 'NOT SET',
      SHARP_API_KEY:    sharpKey ? `set (${sharpKey.slice(0, 8)}...)` : 'NOT SET',
      ODDS_API_KEY:     process.env.ODDS_API_KEY ? 'set' : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   ? 'set' : 'NOT SET',
    },
    apis: {
      oddspapi:    papiStatus,
      odds_api_io: oioStatus,
      sharpapi:    sharpStatus,
    },
  });
}
