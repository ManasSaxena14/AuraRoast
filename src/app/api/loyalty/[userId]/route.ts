import { listLedger, loyaltyFor } from '@/repositories';
import { NotFoundError } from '@/domain/errors';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
/** Tier is DERIVED here on read. It exists in no table (§9.4). */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const view = await loyaltyFor(userId);
    if (!view) throw new NotFoundError('User');
    return ok({ ...view, ledger: await listLedger(userId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return fail(err);
  }
}
