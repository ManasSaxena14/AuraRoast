import { sweepExpired } from '@/repositories';
import { env } from '@/config/env';
import { fail, ok, requireBearer } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * Postgres has no TTL indexes (§4.3). Expiry is a daily sweep: two
 * `DELETE ... WHERE expires_at < now()` statements.
 *
 * Vercel Cron calls the path with GET and `Authorization: Bearer $CRON_SECRET`;
 * POST stays for anything else that schedules it. An unset CRON_SECRET denies.
 */
async function sweep(req: Request) {
  try {
    requireBearer(req, env.CRON_SECRET, 'cron');
    return ok({ swept: await sweepExpired() });
  } catch (err) {
    return fail(err);
  }
}

export const GET = sweep;
export const POST = sweep;
