export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { db } from '@/lib/db';
import { success, error } from '@/lib/api-response';

// Mirror of Prisma AlertType enum — keep in sync with schema.prisma
type AlertType = 'SUREBET' | 'ODDS_DROP' | 'LIMIT_REACHED' | 'ACCOUNT_FLAGGED' | 'SYSTEM';
const VALID_ALERT_TYPES: AlertType[] = ['SUREBET', 'ODDS_DROP', 'LIMIT_REACHED', 'ACCOUNT_FLAGGED', 'SYSTEM'];

function isAlertType(v: string): v is AlertType {
  return VALID_ALERT_TYPES.includes(v as AlertType);
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request.headers.get('cookie'));
    if (!token) return error('Not authenticated', 401);

    const payload = await verifyToken(token);
    if (!payload) return error('Invalid token', 401);

    const { searchParams } = new URL(request.url);
    const typeParam  = searchParams.get('type');
    const unreadOnly = searchParams.get('unread') === 'true';

    const alertType = typeParam && isAlertType(typeParam) ? typeParam : undefined;

    const alerts = await db.alert.findMany({
      where: {
        userId: payload.id,
        ...(alertType  ? { type: alertType } : {}),
        ...(unreadOnly ? { isRead: false }   : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await db.alert.count({
      where: { userId: payload.id, isRead: false },
    });

    return success({ alerts, unreadCount });
  } catch (err) {
    console.error('Alerts error:', err);
    return error('Failed to load alerts', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request.headers.get('cookie'));
    if (!token) return error('Not authenticated', 401);

    const payload = await verifyToken(token);
    if (!payload) return error('Invalid token', 401);

    const body = await request.json() as { type?: string; title?: string; message?: string };
    const { type, title, message } = body;

    if (!type || !title || !message) {
      return error('Type, title, and message are required', 400);
    }

    if (!isAlertType(type)) {
      return error(`Invalid alert type. Valid types: ${VALID_ALERT_TYPES.join(', ')}`, 400);
    }

    const alert = await db.alert.create({
      data: { userId: payload.id, type, title, message },
    });

    return success(alert, 201);
  } catch (err) {
    console.error('Create alert error:', err);
    return error('Failed to create alert', 500);
  }
}
