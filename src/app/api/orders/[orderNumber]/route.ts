import { getOrder } from '@/services/order';
import { NotFoundError } from '@/domain/errors';
import { fail, ok, provesContact } from '@/lib/http';
export const runtime = 'nodejs';
/**
 * Order numbers are sequential (`AT-001045`), so the URL is a guess, not a
 * secret — reading the row costs the caller the email or phone they gave at
 * checkout, sent as `X-Aura-Contact` (§5.4). A wrong proof answers 404 exactly
 * like a number that was never issued: 403-vs-404 is itself an enumeration
 * oracle, and this row carries the guest's address and coordinates.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    const order = await getOrder(orderNumber);
    if (!provesContact(req, order.guestEmail, order.guestPhone)) throw new NotFoundError('Order');
    return ok({ order });
  } catch (err) {
    return fail(err);
  }
}
