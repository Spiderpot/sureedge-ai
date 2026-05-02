import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = [
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

const PUBLIC = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/health',
];

// Edge-compatible JWT verification (no jose needed)
// Verifies HS256 JWT signature using Web Crypto API (available in Edge)
async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;

    // Verify signature
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const signingInput = enc.encode(`${headerB64}.${payloadB64}`);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );

    // Decode base64url signature
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, signingInput);
    if (!valid) return null;

    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    // Check expiry
    if (payload.exp && typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getToken(request: NextRequest): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(r => pathname.startsWith(r));
  const isPublic    = PUBLIC.some(r => pathname.startsWith(r));

  if (!isProtected || isPublic) return NextResponse.next();

  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
  }

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id',    String(payload.id    ?? ''));
  headers.set('x-user-role',  String(payload.role  ?? ''));
  headers.set('x-user-email', String(payload.email ?? ''));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*'],
};
