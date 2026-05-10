export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const oioKey = process.env.ODDS_API_IO_KEY;
  if (!oioKey) return error('ODDS_API_IO_KEY not set', 500);

  const results: Record<string, unknown> = {};

  // Test 1: List available bookmakers
  const bmRes = await fetch(`https://api.odds-api.io/v3/bookmakers?apiKey=${oioKey}`);
  const bmRaw = await bmRes.text();
  results.bookmakers_endpoint = { status: bmRes.status, raw: bmRaw.slice(0, 500) };

  // Test 2: Get live/upcoming events with odds (not cancelled)
  const evRes = await fetch(`https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=football&status=upcoming&limit=2`);
  const evRaw = await evRes.text();
  results.football_events = { status: evRes.status, raw: evRaw.slice(0, 400) };

  // Test 3: Try the arbitrage endpoint directly
  const arbRes = await fetch(`https://api.odds-api.io/v3/arbitrage-bets?apiKey=${oioKey}&sport=football`);
  const arbRaw = await arbRes.text();
  results.arbitrage_endpoint = { status: arbRes.status, raw: arbRaw.slice(0, 500) };

  // Test 4: Check sports list  
  const spRes = await fetch(`https://api.odds-api.io/v3/sports?apiKey=${oioKey}`);
  const spRaw = await spRes.text();
  results.sports = { status: spRes.status, raw: spRaw.slice(0, 300) };

  return success({ timestamp: new Date().toISOString(), results });
}
