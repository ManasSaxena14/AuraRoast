import { attachUtr } from '@/services/order';
import { getOrderByNumber } from '@/repositories';
import { isPlausibleUtr } from '@/lib/upi';
import { DomainError, NotFoundError } from '@/domain/errors';
import { fail, mayManageOrder, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer, publicOrderView } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Attach the guest's UPI transaction reference to their own order, so the
 * person verifying transfers can match it. Guarded like every other write on
 * an order: the checkout contact, or the signed-in owner.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const limited = await rateLimit(req, 'utr', 10, 60_000);
  if (limited) return limited;

  try {
    const { orderNumber } = await params;

    const body = await readJson(req);
    const utr = (body as { utr?: unknown } | null)?.utr;
    if (typeof utr !== 'string' || !isPlausibleUtr(utr)) {
      throw new DomainError('A UTR is 12 digits, from your UPI app.', 'invalid_utr', 400);
    }

    const [existing, viewer] = await Promise.all([getOrderByNumber(orderNumber), getViewer()]);
    if (!existing || !mayManageOrder(req, existing, viewer)) {
      throw new NotFoundError('Order');
    }
    if (existing.paymentMethod !== 'upi') {
      throw new DomainError('That order is not paid by UPI.', 'not_upi', 409);
    }

    return ok({ order: publicOrderView(await attachUtr(orderNumber, utr)) });
  } catch (err) {
    return fail(err);
  }
}
