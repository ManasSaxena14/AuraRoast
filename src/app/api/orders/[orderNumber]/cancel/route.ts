import { cancelOrder } from '@/services/order';
import { fail, ok, provesContact } from '@/lib/http';
import { NotFoundError } from '@/domain/errors';
import { getOrderByNumber } from '@/repositories';

export const runtime = 'nodejs';

/**
 * Cancellable until out_for_delivery — enforced by the state machine.
 *
 * Order numbers are sequential, so without an ownership proof this endpoint let
 * anyone cancel a stranger's order by counting upwards. Same `X-Aura-Contact`
 * proof as GET on the order itself, and the same deliberate 404 on failure: a
 * 403 here would confirm which order numbers exist.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;

    const existing = await getOrderByNumber(orderNumber);
    if (!existing || !provesContact(req, existing.guestEmail, existing.guestPhone)) {
      throw new NotFoundError('Order');
    }

    return ok({ order: await cancelOrder(orderNumber) });
  } catch (err) {
    return fail(err);
  }
}
