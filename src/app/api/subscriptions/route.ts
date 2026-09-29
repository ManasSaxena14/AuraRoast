import { z } from 'zod';
import { insertSubscription, listDrinks, listSubscriptions, updateSubscription } from '@/repositories';
import { assertSubscriptionTransition } from '@/domain/state-machine';
import { addDays, toDateKey } from '@/domain/slots';
import { uuid } from '@/lib/ids';
import { DomainError, NotFoundError } from '@/domain/errors';
import { fail, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer } from '@/lib/session';
import type { SubscriptionCadence } from '@/domain/types';

export const runtime = 'nodejs';

const CADENCE_DAYS: Record<SubscriptionCadence, number> = { weekly: 7, biweekly: 14, monthly: 30 };

const createSchema = z.object({
  drinkId: z.string().max(64).nullish(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']),
  quantity: z.number().int().min(1).max(20).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  skip: z.boolean().optional(),
});

/** A standing order belongs to an account, so every verb needs one. */
async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) throw new DomainError('Sign in to manage subscriptions.', 'auth_required', 401);
  return viewer;
}

export async function GET() {
  try {
    const viewer = await requireViewer();
    return ok(
      { subscriptions: await listSubscriptions(viewer.user.id) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, 'subscriptions', 10, 60_000);
  if (limited) return limited;
  try {
    const viewer = await requireViewer();
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new DomainError('Unknown cadence.', 'bad_cadence', 400, parsed.error.issues);
    }
    const body = parsed.data;
    if (body.drinkId) {
      // Whole bean only — a subscription to a flat white does not ship well.
      const drink = (await listDrinks()).find((d) => d.id === body.drinkId);
      if (!drink || drink.category !== 'beans') {
        throw new DomainError('Only whole-bean coffee can be subscribed to.', 'not_subscribable', 400);
      }
    }
    const sub = await insertSubscription({
      id: uuid(),
      userId: viewer.user.id,
      drinkId: body.drinkId ?? null,
      cadence: body.cadence,
      quantity: body.quantity ?? 1,
      nextDelivery: addDays(toDateKey(), CADENCE_DAYS[body.cadence]),
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    return ok({ subscription: sub }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const viewer = await requireViewer();
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new DomainError('That change could not be read.', 'invalid_body', 400, parsed.error.issues);
    }
    const body = parsed.data;
    // Scoped to the caller's own list: an id that is not theirs is not found.
    const current = (await listSubscriptions(viewer.user.id)).find((s) => s.id === body.id);
    if (!current) throw new NotFoundError('Subscription');

    if (body.skip) {
      if (current.status === 'cancelled') {
        throw new DomainError('That subscription is cancelled.', 'cancelled', 409);
      }
      const next = addDays(current.nextDelivery, CADENCE_DAYS[current.cadence]);
      return ok({ subscription: await updateSubscription(body.id, { nextDelivery: next }) });
    }
    if (body.status) {
      assertSubscriptionTransition(current.status, body.status);
      return ok({ subscription: await updateSubscription(body.id, { status: body.status }) });
    }
    throw new DomainError('Nothing to change.', 'noop', 400);
  } catch (err) {
    return fail(err);
  }
}
