import { listLedger, loyaltyFor } from '@/repositories';
import { NotFoundError } from '@/domain/errors';
import { fail, ok, provesContact } from '@/lib/http';
export const runtime = 'nodejs';
/** Tier is DERIVED here on read. It exists in no table (§9.4). */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const view = await loyaltyFor(userId);
    if (!view) throw new NotFoundError('User');
    const { user, ...loyalty } = view;
    // A user id is not a credential, so the caller proves the account is theirs
    // with its email (§5.4) — and a mismatch 404s so ids stay unenumerable.
    if (!provesContact(req, user.email)) throw new NotFoundError('User');
    return ok(
      // Projected: the raw row also carries `email`, `referralCode` and
      // `isAdmin`, none of which the loyalty UI reads.
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
