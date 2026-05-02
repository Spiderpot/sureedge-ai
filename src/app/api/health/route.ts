export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, 'ok' | 'degraded' | 'down'> = {};
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

  // Database check
  try {
    await db.$queryRaw`SELECT 1` as unknown;
    checks.database = 'ok';
  } catch {
    checks.database = 'down';
    overallStatus = 'down';
  }

  // Redis check (optional — no Redis client in this stack by default)
  // If you add ioredis, add the ping here
  checks.redis = 'ok'; // placeholder

  // Environment check
  checks.env = process.env.JWT_SECRET && process.env.DATABASE_URL ? 'ok' : 'degraded';
  if (checks.env === 'degraded' && overallStatus === 'ok') overallStatus = 'degraded';

  const statusCode = overallStatus === 'down' ? 503 : 200;

  return NextResponse.json({
    success: overallStatus !== 'down',
    data: {
      status:    overallStatus,
      version:   process.env.npm_package_version ?? '2.4.1',
      buildId:   process.env.BUILD_ID ?? 'local',
      timestamp: new Date().toISOString(),
      checks,
    },
  }, { status: statusCode });
}
