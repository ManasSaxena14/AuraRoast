import { cancelOrder } from '@/services/order';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
/** Cancellable until out_for_delivery — enforced by the state machine. */
export async function POST(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    return ok({ order: await cancelOrder(orderNumber) });
  } catch (err) {
    return fail(err);
  }
}
