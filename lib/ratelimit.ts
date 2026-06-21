import { NextResponse } from "next/server";

/**
 * In-memory fixed-window rate limiter. Sufficient for a single-instance demo: it
 * closes the live-demo failure modes a judge can trigger — draining the paid AI
 * Gateway via the unauthenticated /api/task,/assistant,/score routes, and
 * brute-forcing the seeded employer login. For multi-instance production, swap
 * the Map for Upstash/Redis (same interface).
 */
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // seconds
  remaining: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep so the Map can't grow unbounded in a long-lived process.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  b.count++;
  return { ok: true, retryAfter: 0, remaining: limit - b.count };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Enforce a per-IP limit for a named route. Returns a ready-to-return 429
 * response when the limit is exceeded, or `null` to continue. Optionally scope
 * the bucket further (e.g. by email) via `subkey`.
 */
export function limited(
  req: Request,
  name: string,
  limit: number,
  windowMs: number,
  subkey = ""
): NextResponse | null {
  const res = rateLimit(`${name}:${clientIp(req)}:${subkey}`, limit, windowMs);
  if (res.ok) return null;
  return NextResponse.json(
    { error: "Too many requests — please slow down." },
    { status: 429, headers: { "Retry-After": String(res.retryAfter) } }
  );
}
