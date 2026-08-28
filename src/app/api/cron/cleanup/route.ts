import { sweepExpired } from '@/repositories';
import { env } from '@/config/env';
import { ForbiddenError } from '@/domain/errors';
import { fail, ok } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * Postgres has no TTL indexes (§4.3). Expiry is a daily sweep: two
 * `DELETE ... WHERE expires_at < now()` statements, run from Vercel Cron.
 */
export async function POST(req: Request) {
  try {
    if (env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
      throw new ForbiddenError('Bad cron secret.');
    }
    return ok({ swept: await sweepExpired() });
  } catch (err) {
    return fail(err);
  }
}
