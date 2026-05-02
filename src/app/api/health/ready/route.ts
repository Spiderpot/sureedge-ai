export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1` as unknown;
    return NextResponse.json(
      { success: true, data: { status: 'ready', db: 'connected' } },
      { status: 200 }
    );
  } catch {
    // Return 503 — load balancer will stop sending traffic to this instance
    return NextResponse.json(
      { success: false, data: { status: 'not-ready', db: 'disconnected' } },
      { status: 503 }
    );
  }
}
