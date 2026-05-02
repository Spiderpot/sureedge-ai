export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { db } from '@/lib/db';
import { success, error } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request.headers.get('cookie'));
    if (!token) {
      return error('Not authenticated', 401);
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return error('Invalid token', 401);
    }

    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        balance: true,
        totalProfit: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      return error('User not found', 404);
    }

    return success(user);
  } catch {
    return error('Authentication failed', 500);
  }
}
