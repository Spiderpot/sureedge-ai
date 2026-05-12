export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';

interface ActivityItem { ts: number; sport: string; event: string; type: string }

// Simple in-memory log — resets on each cold start
// For persistence, save to Neon DB
const log: ActivityItem[] = [];

export async function GET() {
  return Response.json({
    success: true,
    data: { activities: log.slice(0, 20), lastUpdated: new Date().toISOString() }
  });
}

export async function POST(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const body = await request.json() as ActivityItem;
    log.unshift({ ...body, ts: Date.now() });
    if (log.length > 50) log.pop();
  } catch { /* ignore */ }
  return new Response('ok');
}
