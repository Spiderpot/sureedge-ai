export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return error('Unauthorized', 401);

  const oioKey = process.env.ODDS_API_IO_KEY;
  if (!oioKey) return error('ODDS_API_IO_KEY not set', 500);

  // Step 1: Get raw events response
  const evRes = await fetch(`https://api.odds-api.io/v3/events?apiKey=${oioKey}&sport=basketball&limit=2`);
  const evRaw = await evRes.text();
  
  // Step 2: Parse and show structure
  let evParsed: unknown = null;
  try { evParsed = JSON.parse(evRaw); } catch { evParsed = evRaw.slice(0, 500); }

  // Step 3: Get first event ID from whatever structure it is
  let eventId = '';
  let oddsRaw = '';
  
  if (Array.isArray(evParsed) && evParsed.length > 0) {
    const first = evParsed[0] as Record<string, unknown>;
    eventId = String(first.id ?? first.eventId ?? first.event_id ?? Object.keys(first).join(','));
  } else if (evParsed && typeof evParsed === 'object') {
    const d = evParsed as Record<string, unknown>;
    const items = d.data ?? d.events ?? d.results ?? d.items ?? [];
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0] as Record<string, unknown>;
      eventId = String(first.id ?? first.eventId ?? first.event_id ?? '');
    }
  }

  // Step 4: Test odds endpoint with first event
  if (eventId) {
    const oddsRes = await fetch(`https://api.odds-api.io/v3/odds?apiKey=${oioKey}&eventId=${eventId}&market=moneyline`);
    oddsRaw = await oddsRes.text();
  }

  return success({
    timestamp: new Date().toISOString(),
    events_status: evRes.status,
    events_raw_sample: evRaw.slice(0, 1000),
    event_id_found: eventId,
    odds_raw_sample: oddsRaw.slice(0, 1000),
  });
}
