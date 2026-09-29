import { placeOrder } from '@/services/order';
import { fail, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer } from '@/lib/session';
import { MissingIdempotencyKeyError } from '@/domain/errors';

export const runtime = 'nodejs';

/**
 * Place an order. REQUIRES an `Idempotency-Key` header (§9.3) — a request
 * without one is rejected, not quietly accepted.
 *
 * A signed-in guest's order is attached to their account from the SESSION;
 * nothing in the body can name an account.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'orders', 12, 60_000);
  if (limited) return limited;

  try {
    const key = req.headers.get('Idempotency-Key');
    if (!key) throw new MissingIdempotencyKeyError();

    const [body, viewer] = await Promise.all([readJson(req), getViewer()]);
    const { order, replayed, priceMismatch } = await placeOrder(body, key, viewer?.user.id ?? null);

    return ok(
      { order, replayed, priceMismatch },
      { status: replayed ? 200 : 201, headers: { 'Idempotency-Replayed': String(replayed) } },
    );
  } catch (err) {
    return fail(err);
  }
}
