import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/api/surebet',
  '/api/ai',
  '/api/risk',
  '/api/bankroll',
  '/api/analytics',
  '/api/alerts',
  '/api/odds',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/refresh',
];

// Routes exempt from auth (public)
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/health',
];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

function getToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isPublic    = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  if (!isProtected || isPublic) {
    return NextResponse.next();
  }

  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Attach user info to headers for downstream route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id',   String(payload.id ?? ''));
    requestHeaders.set('x-user-role', String(payload.role ?? ''));
    requestHeaders.set('x-user-email', String(payload.email ?? ''));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
