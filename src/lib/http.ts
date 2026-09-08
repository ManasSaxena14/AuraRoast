import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DomainError, ForbiddenError } from '@/domain/errors';
import { takeToken } from '@/repositories';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Read-heavy GETs get stale-while-revalidate at the CDN (§16.2). */
export function cached<T>(data: T, seconds = 60) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 10}`,
    },
  });
}

export function fail(err: unknown) {
  if (err instanceof DomainError) {
    return NextResponse.json(
      { error: err.message, code: err.code, details: err.details },
      { status: err.status },
    );
  }
  console.error('unhandled_route_error', err);
  return NextResponse.json({ error: 'Something went wrong.', code: 'internal' }, { status: 500 });
}

/** Constant-time compare. Both sides are digested first so length never leaks. */
function secretEquals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}

/**
 * Server-to-server bearer gate (§5.4). A MISSING secret denies rather than
 * opens: a forgotten environment variable must never be the thing that
 * publishes a privileged route.
 */
export function requireBearer(req: Request, secret: string | undefined, what: string): void {
  const header = req.headers.get('authorization') ?? '';
  if (!secret || !secretEquals(header, `Bearer ${secret}`)) {
    throw new ForbiddenError(`Bad ${what} secret.`);
  }
}

/** Emails compare case-insensitively; phone numbers on their last 10 digits. */
function normalizeContact(value: string): string {
  const trimmed = value.trim();
  if (!/^[+\d][\d\s()+-]*$/.test(trimmed)) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, '').slice(-10);
}

/**
 * Ownership proof for records that have no session behind them (§5.4).
 *
 * Guests never sign in, so the only thing a guest knows that a stranger does
 * not is the contact detail they typed themselves. It travels as a header, not
 * a query param — an email in a URL ends up in every access log on the way.
 */
export function provesContact(req: Request, ...expected: (string | null | undefined)[]): boolean {
  const supplied = req.headers.get('x-aura-contact')?.trim();
  if (!supplied) return false;
  const candidate = normalizeContact(supplied);
  if (!candidate) return false;
  return expected.some((value) => !!value && secretEquals(candidate, normalizeContact(value)));
}

/**
 * Best-effort client identity for the token bucket.
 *
 * `x-forwarded-for` is APPENDED to by proxies, so its leftmost entry is
 * whatever the caller typed — using it let anyone mint a fresh bucket per
 * request and made every limit in §6.6 decorative. Only a header a trusted hop
 * *overwrites* counts, and we only know we are behind one from `VERCEL`, which
 * is set on the server and cannot be spoofed by a request. Anywhere else every
 * caller shares one bucket: over-strict beats unlimited.
 *
 * `TRUST_PROXY_HEADERS=1` is the escape hatch for a self-hosted deploy behind
 * an nginx/Cloudflare hop that overwrites the header. It is opt-in and set on
 * the server, so a request still cannot grant itself a private bucket — but
 * turning it on when nothing overwrites the header re-opens the spoof.
 */
export function clientKey(req: Request): string {
  if (process.env.VERCEL === '1') {
    const vercel = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-real-ip');
    return vercel?.split(',')[0]?.trim() || 'shared';
  }
  if (process.env.TRUST_PROXY_HEADERS === '1') {
    const forwarded = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim() || 'shared';
  }
  return 'shared';
}

/** The Postgres-native token bucket (§6.6) — no Redis dependency. */
export async function rateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const res = await takeToken(`${scope}:${clientKey(req)}`, limit, windowMs);
  if (res.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Give it a moment.', code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(res.retryAfterSec) } },
  );
}
