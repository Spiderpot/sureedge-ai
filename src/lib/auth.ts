import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// Security: No fallback secret. If JWT_SECRET is missing, crash immediately.
// This prevents running with a known/weak secret in production.
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET env var is required and must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

// Access token: 15 minutes (short-lived, reduces exposure window)
const ACCESS_TOKEN_EXPIRY = '15m';
// Refresh token: 7 days
const REFRESH_TOKEN_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain an uppercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain a number' };
  return { valid: true };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.toLowerCase());
}

interface TokenPayload {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export async function createAccessToken(user: TokenPayload): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function createRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ id: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getSecret());
}

// Legacy: single token (used for compatibility in some routes)
export async function createToken(user: TokenPayload): Promise<string> {
  return createAccessToken(user);
}

export async function verifyToken(token: string): Promise<(TokenPayload & { iat: number; exp: number }) | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as TokenPayload & { iat: number; exp: number };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ id: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== 'refresh') return null;
    return { id: payload.id as string };
  } catch {
    return null;
  }
}

export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const tokenCookie = cookies.find(c => c.startsWith('token='));
  return tokenCookie ? decodeURIComponent(tokenCookie.split('=').slice(1).join('=')) : null;
}

export function getRefreshTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const tokenCookie = cookies.find(c => c.startsWith('refresh_token='));
  return tokenCookie ? decodeURIComponent(tokenCookie.split('=').slice(1).join('=')) : null;
}
