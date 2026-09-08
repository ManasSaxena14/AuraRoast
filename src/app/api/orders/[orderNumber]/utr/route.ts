import { attachUtr } from '@/services/order';
import { getOrderByNumber } from '@/repositories';
import { isPlausibleUtr } from '@/lib/upi';
import { DomainError, NotFoundError } from '@/domain/errors';
import { fail, ok, provesContact, rateLimit } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * Attach the guest's UPI transaction reference to their own order.
 *
 * `attachUtr` existed in the service layer with nothing calling it, so the
 * confirmation screen fired a GET it discarded and then claimed "Reference
 * noted" — the reference was never stored. This is that missing endpoint.
 *
 * Guarded by the same `X-Aura-Contact` proof as the other order routes, and
 * 404s rather than 403s on a bad proof so sequential order numbers stay
 * unenumerable.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const limited = await rateLimit(req, 'utr', 10, 60_000);
  if (limited) return limited;

  try {
    const { orderNumber } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new DomainError('Malformed JSON body.', 'invalid_json', 400);
    }
    const utr = (body as { utr?: unknown })?.utr;
    if (typeof utr !== 'string' || !isPlausibleUtr(utr)) {
      throw new DomainError('A UTR is 12 digits, from your UPI app.', 'invalid_utr', 400);
    }

    const existing = await getOrderByNumber(orderNumber);
    if (!existing || !provesContact(req, existing.guestEmail, existing.guestPhone)) {
      throw new NotFoundError('Order');
    }

    return ok({ order: await attachUtr(orderNumber, utr) });
  } catch (err) {
    return fail(err);
  }
}
