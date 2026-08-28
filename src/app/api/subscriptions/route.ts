import { DEMO_USER_ID, insertSubscription, listSubscriptions, updateSubscription } from '@/repositories';
import { assertSubscriptionTransition } from '@/domain/state-machine';
import { toDateKey } from '@/domain/slots';
import { uuid } from '@/lib/ids';
import { DomainError, NotFoundError } from '@/domain/errors';
import { fail, ok } from '@/lib/http';
import type { SubscriptionCadence } from '@/domain/types';

export const runtime = 'nodejs';

const CADENCE_DAYS: Record<SubscriptionCadence, number> = { weekly: 7, biweekly: 14, monthly: 30 };

export async function GET() {
  try {
    return ok({ subscriptions: await listSubscriptions(DEMO_USER_ID) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      drinkId: string | null;
      cadence: SubscriptionCadence;
      quantity?: number;
    };
    if (!CADENCE_DAYS[body.cadence]) throw new DomainError('Unknown cadence.', 'bad_cadence', 400);
    const next = new Date();
    next.setDate(next.getDate() + CADENCE_DAYS[body.cadence]);
    const sub = await insertSubscription({
      id: uuid(),
      userId: DEMO_USER_ID,
      drinkId: body.drinkId ?? null,
      cadence: body.cadence,
      quantity: Math.max(1, body.quantity ?? 1),
      nextDelivery: toDateKey(next),
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
    const body = (await req.json()) as { id: string; status?: 'active' | 'paused' | 'cancelled'; skip?: boolean };
    const all = await listSubscriptions(DEMO_USER_ID);
    const current = all.find((s) => s.id === body.id);
    if (!current) throw new NotFoundError('Subscription');

    if (body.skip) {
      const next = new Date(current.nextDelivery);
      next.setDate(next.getDate() + CADENCE_DAYS[current.cadence]);
      return ok({ subscription: await updateSubscription(body.id, { nextDelivery: toDateKey(next) }) });
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
