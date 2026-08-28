import { NextResponse } from 'next/server';
import { DomainError } from '@/domain/errors';
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

/** Best-effort client identity for the token bucket. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim();
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
