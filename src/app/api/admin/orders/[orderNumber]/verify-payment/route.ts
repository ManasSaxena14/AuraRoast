import { verifyUpiPayment } from '@/services/order';
import { DEMO_USER_ID, getUser } from '@/repositories';
import { ForbiddenError } from '@/domain/errors';
import { fail, ok } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * The ONLY path that can confirm a UPI order (§8.4). Admin-only, and the check
 * is re-verified here rather than trusting a middleware gate alone (§5.4).
 */
export async function PATCH(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    const admin = await getUser(DEMO_USER_ID);
    if (!admin?.isAdmin) throw new ForbiddenError('Admin only.');
    return ok({ order: await verifyUpiPayment(orderNumber, admin.id) });
  } catch (err) {
    return fail(err);
  }
}
