export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyRefreshToken, createAccessToken } from '@/lib/auth';
import { success, error } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const match = cookieHeader?.match(/(?:^|;\s*)refresh_token=([^;]+)/);
    const refreshToken = match ? decodeURIComponent(match[1]) : null;

    if (!refreshToken) {
      return error('Refresh token required', 401);
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return error('Invalid or expired refresh token', 401);
    }

    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return error('User not found or inactive', 401);
    }

    const newAccessToken = await createAccessToken({ id: user.id, email: user.email, name: user.name, role: user.role });

    const response = success({ message: 'Token refreshed' });
    response.cookies.set('token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Token refresh error:', err);
    return error('Token refresh failed', 500);
  }
}
