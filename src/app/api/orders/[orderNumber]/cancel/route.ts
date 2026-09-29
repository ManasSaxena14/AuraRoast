import { cancelOrder } from '@/services/order';
import { fail, mayManageOrder, ok, rateLimit } from '@/lib/http';
import { getViewer, publicOrderView } from '@/lib/session';
import { NotFoundError } from '@/domain/errors';
import { getOrderByNumber } from '@/repositories';

export const runtime = 'nodejs';

/**
 * Cancellable until out_for_delivery — enforced by the state machine.
 *
 * Needs the same ownership proof as reading the order: the contact given at
 * checkout, or the signed-in account that placed it. A failed proof is a 404,
 * so the endpoint cannot be used to discover which order numbers exist.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const limited = await rateLimit(req, 'cancel', 10, 60_000);
  if (limited) return limited;

  try {
    const { orderNumber } = await params;
    const [existing, viewer] = await Promise.all([getOrderByNumber(orderNumber), getViewer()]);
    if (!existing || !mayManageOrder(req, existing, viewer)) {
      throw new NotFoundError('Order');
    }
    return ok({ order: publicOrderView(await cancelOrder(orderNumber)) });
  } catch (err) {
    return fail(err);
  }
}
