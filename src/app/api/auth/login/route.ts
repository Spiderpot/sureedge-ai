export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createAccessToken, createRefreshToken, validateEmail } from '@/lib/auth';
import { success, error } from '@/lib/api-response';
import { authLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 5 attempts per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';

    const limit = authLimiter(ip);
    if (!limit.allowed) {
      return error('Too many login attempts. Please wait before trying again.', 429);
    }

    const body = await request.json().catch(() => ({}));
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return error('Email and password are required', 400);
    }

    if (!validateEmail(email)) {
      return error('Invalid email format', 400);
    }

    // Always query and compare — avoid timing attacks (don't short-circuit on user not found)
    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Constant-time-ish: always run bcrypt even if user not found
    const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks.only';
    const passwordToCheck = user?.passwordHash ?? dummyHash;
    const valid = await verifyPassword(password, passwordToCheck);

    if (!user || !valid) {
      // Log failed attempt (don't reveal whether email exists)
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
        }).catch(() => {}); // non-fatal
      }
      return error('Invalid credentials', 401);
    }

    if (!user.isActive) {
      return error('Account is disabled. Contact support.', 403);
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return error(`Account locked. Try again in ${minutesLeft} minute(s).`, 429);
    }

    // Lock after 10 consecutive failures
    if (user.failedLoginCount >= 10) {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      await db.user.update({ where: { id: user.id }, data: { lockedUntil } });
      return error('Account locked after too many failed attempts. Try again in 30 minutes.', 429);
    }

    // Success — reset failed count, update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), failedLoginCount: 0, lockedUntil: null },
    });

    const accessToken  = await createAccessToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    const response = success({ id: user.id, email: user.email, name: user.name, role: user.role });

    // Access token: 15 min, httpOnly
    response.cookies.set('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    // Refresh token: 7 days, httpOnly, restricted to refresh endpoint
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return error('Login failed', 500);
  }
}
