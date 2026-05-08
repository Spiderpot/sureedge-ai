export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { diagnosePapi } from '@/lib/odds-engine';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) return error('Unauthorized', 401);

  const papiLog = await diagnosePapi();

  return success({
    timestamp: new Date().toISOString(),
    env: {
      ODDSPAPI_API_KEY: process.env.ODDSPAPI_API_KEY ? `set (${process.env.ODDSPAPI_API_KEY.slice(0, 8)}...)` : 'NOT SET',
      ODDS_API_KEY: process.env.ODDS_API_KEY ? 'set' : 'NOT SET',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'NOT SET',
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? 'set' : 'NOT SET',
      CRON_SECRET: process.env.CRON_SECRET ? 'set' : 'NOT SET',
    },
    oddspapi: papiLog,
  });
}
