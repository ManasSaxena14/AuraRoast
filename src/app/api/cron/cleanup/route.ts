import { sweepExpired } from '@/repositories';
import { env } from '@/config/env';
import { fail, ok, requireBearer } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * Postgres has no TTL indexes (§4.3). Expiry is a daily sweep: two
 * `DELETE ... WHERE expires_at < now()` statements, run from Vercel Cron.
 */
export async function POST(req: Request) {
  try {
    // `env.CRON_SECRET && ...` skipped the check whenever the variable was
    // absent, so a deploy that forgot to set it published a destructive sweep.
    requireBearer(req, env.CRON_SECRET, 'cron');
    return ok({ swept: await sweepExpired() });
  } catch (err) {
    return fail(err);
  }
}
