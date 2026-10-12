import { placeOrder } from '@/services/order';
import { fail, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer } from '@/lib/session';
import { DomainError, MissingIdempotencyKeyError } from '@/domain/errors';

export const runtime = 'nodejs';

/**
 * Place an order. REQUIRES an `Idempotency-Key` header (§9.3) — a request
 * without one is rejected, not quietly accepted.
 *
 * Requires a signed-in account (401 otherwise). The order is attached to that
 * account from the SESSION; nothing in the body can name an account.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'orders', 12, 60_000);
  if (limited) return limited;

  try {
    const key = req.headers.get('Idempotency-Key');
    if (!key) throw new MissingIdempotencyKeyError();

    const [body, viewer] = await Promise.all([readJson(req), getViewer()]);
    // Orders are placed from an account: it is what tracking, cancelling,
    // loyalty points and the order history all hang off.
    if (!viewer) throw new DomainError('Sign in to place an order.', 'auth_required', 401);
    const { order, replayed, priceMismatch } = await placeOrder(body, key, viewer.user.id);

    return ok(
      { order, replayed, priceMismatch },
      { status: replayed ? 200 : 201, headers: { 'Idempotency-Replayed': String(replayed) } },
    );
  } catch (err) {
    return fail(err);
  }
}
