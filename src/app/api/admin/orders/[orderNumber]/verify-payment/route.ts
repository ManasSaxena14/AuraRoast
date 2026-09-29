import { verifyUpiPayment } from '@/services/order';
import { ForbiddenError } from '@/domain/errors';
import { fail, hasBearer, ok } from '@/lib/http';
import { getViewer } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * The ONLY path that can confirm a UPI order (§8.4).
 *
 * Two ways in, both server-side:
 *   · a signed-in admin — a Google account listed in ADMIN_EMAILS (or flagged
 *     `is_admin` in the users table); this is what the /admin page uses
 *   · `Authorization: Bearer $ADMIN_SECRET`, for scripts and back-office tools
 *
 * Neither variable set means nobody gets in: a missing env var must never be
 * the thing that opens the money path.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    const viewer = await getViewer();
    const bySecret = hasBearer(req, process.env.ADMIN_SECRET);
    if (!viewer?.isAdmin && !bySecret) throw new ForbiddenError('Admin only.');
    return ok({ order: await verifyUpiPayment(orderNumber, viewer?.user.id ?? 'bearer') });
  } catch (err) {
    return fail(err);
  }
}
