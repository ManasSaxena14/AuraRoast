import { getOrder } from '@/services/order';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    return ok({ order: await getOrder(orderNumber) });
  } catch (err) {
    return fail(err);
  }
}
