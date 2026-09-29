import { listLedger, loyaltyFor } from '@/repositories';
import { NotFoundError } from '@/domain/errors';
import { fail, ok, provesContact } from '@/lib/http';
import { getViewer } from '@/lib/session';

export const runtime = 'nodejs';

/** Tier is DERIVED here on read. It exists in no table (§9.4). */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const [view, viewer] = await Promise.all([loyaltyFor(userId), getViewer()]);
    if (!view) throw new NotFoundError('User');
    const { user, ...loyalty } = view;
    // A user id is not a credential: the caller is that account, or proves the
    // account's email (§5.4). A mismatch 404s so ids stay unenumerable.
    if (viewer?.user.id !== user.id && !provesContact(req, user.email)) {
      throw new NotFoundError('User');
    }
    return ok(
      {
        user: { id: user.id, name: user.name, image: user.image },
        ...loyalty,
        ledger: await listLedger(userId),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return fail(err);
  }
}
