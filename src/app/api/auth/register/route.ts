export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createAccessToken, createRefreshToken, validateEmail, validatePasswordStrength } from '@/lib/auth';
import { success, error } from '@/lib/api-response';
import { authLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const limit = authLimiter(ip);
    if (!limit.allowed) {
      return error('Too many requests. Please wait before trying again.', 429);
    }

    const body = await request.json().catch(() => ({}));
    const { email, name, password } = body as { email?: string; name?: string; password?: string };

    if (!email || !password) {
      return error('Email and password are required', 400);
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedName  = name?.trim() || null;

    if (!validateEmail(trimmedEmail)) {
      return error('Invalid email format', 400);
    }

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return error(pwCheck.error ?? 'Password too weak', 400);
    }

    if (trimmedName && (trimmedName.length < 2 || trimmedName.length > 100)) {
      return error('Name must be between 2 and 100 characters', 400);
    }

    const existing = await db.user.findUnique({ where: { email: trimmedEmail } });
    if (existing) {
      return error('Email already registered', 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email: trimmedEmail, name: trimmedName, passwordHash },
    });

    const accessToken  = await createAccessToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    const response = success({ id: user.id, email: user.email, name: user.name, role: user.role }, 201);

    response.cookies.set('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    });

    return response;
  } catch (err) {
    console.error('Register error:', err);
    return error('Registration failed', 500);
  }
}
