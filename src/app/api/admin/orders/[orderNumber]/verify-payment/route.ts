import { verifyUpiPayment } from '@/services/order';
import { DEMO_USER_ID, getUser } from '@/repositories';
import { ForbiddenError } from '@/domain/errors';
import { fail, ok, requireBearer } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * The ONLY path that can confirm a UPI order (§8.4), so it is gated on a
 * server-side shared secret (§5.4).
 *
 * `getUser(DEMO_USER_ID).isAdmin` was never an identity check — the id is a
 * module constant, not something derived from the request, so every anonymous
 * caller satisfied it. Until Auth.js is wired (§5.1) the bearer token is the
 * gate; the demo user is kept only to attribute the verification. An unset
 * ADMIN_SECRET DENIES: a missing env var must not open the money path.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    requireBearer(req, process.env.ADMIN_SECRET, 'admin');
    const admin = await getUser(DEMO_USER_ID);
    if (!admin?.isAdmin) throw new ForbiddenError('Admin only.');
    return ok({ order: await verifyUpiPayment(orderNumber, admin.id) });
  } catch (err) {
    return fail(err);
  }
}
