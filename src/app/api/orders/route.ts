import { placeOrder } from '@/services/order';
import { fail, ok, rateLimit } from '@/lib/http';
import { MissingIdempotencyKeyError } from '@/domain/errors';

export const runtime = 'nodejs';

/**
 * Place an order. REQUIRES an `Idempotency-Key` header (§9.3) — a request
 * without one is rejected, not quietly accepted.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'orders', 12, 60_000);
  if (limited) return limited;

  try {
    const key = req.headers.get('Idempotency-Key');
    if (!key) throw new MissingIdempotencyKeyError();

    const body = await req.json();
    const { order, replayed, priceMismatch } = await placeOrder(body, key);

    return ok(
      { order, replayed, priceMismatch },
      { status: replayed ? 200 : 201, headers: { 'Idempotency-Replayed': String(replayed) } },
    );
  } catch (err) {
    return fail(err);
  }
}
