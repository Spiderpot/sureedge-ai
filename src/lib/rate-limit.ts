// In-memory rate limiter — safe for both Vercel serverless and Docker/Node
// Note: Vercel serverless = per-instance (not shared across instances).
// For shared rate limiting on Vercel, swap this for Upstash Redis:
//   https://upstash.com  (free: 10k req/day)

interface Entry { count: number; resetAt: number }

// Module-level Map — persists across requests within the same warm instance
const store = new Map<string, Entry>();

// Cleanup: guard setInterval — crashes in some edge runtimes
if (typeof globalThis !== 'undefined' && typeof (globalThis as typeof globalThis & { setInterval?: unknown }).setInterval === 'function') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
  }, 5 * 60 * 1000);
  // Allow process to exit even if interval is pending (Node.js)
  if (typeof interval === 'object' && interval !== null && 'unref' in interval) {
    (interval as NodeJS.Timeout).unref();
  }
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Pre-built limiters
export const authLimiter = (ip: string) => rateLimit(`auth:${ip}`, 5, 60_000);
export const apiLimiter  = (ip: string) => rateLimit(`api:${ip}`,  60, 60_000);
