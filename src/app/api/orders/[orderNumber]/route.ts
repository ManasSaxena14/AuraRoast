import { getOrder } from '@/services/order';
import { NotFoundError } from '@/domain/errors';
import { fail, mayManageOrder, ok } from '@/lib/http';
import { getViewer } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * The full order row — address, coordinates, contact details. Reading it costs
 * the caller the email or phone they gave at checkout (sent as
 * `X-Aura-Contact`, §5.4), or being the signed-in account that placed it. A
 * wrong proof answers 404 exactly like a number that was never issued:
 * 403-vs-404 is itself an enumeration oracle.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    const [order, viewer] = await Promise.all([getOrder(orderNumber), getViewer()]);
    if (!mayManageOrder(req, order, viewer)) throw new NotFoundError('Order');
    return ok({ order }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return fail(err);
  }
}
