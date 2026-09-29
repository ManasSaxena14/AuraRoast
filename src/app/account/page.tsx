import type { Metadata } from 'next';
import { features } from '@/config/env';
import { getViewer } from '@/lib/session';
import { deriveTrackingState } from '@/domain/tracking';
import { withDerivedPlan } from '@/services/order';
import { listDrinks, listOrdersForUser, listSubscriptions, loyaltyFor } from '@/repositories';
import { Account, type AccountOrder } from '@/components/account/Account';
import { GuestAccount } from '@/components/account/GuestAccount';

export const metadata: Metadata = { title: 'Account', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Signed in: that account's orders, points and standing orders — and nobody
 * else's. (This page used to list the twenty most recent orders from EVERY
 * guest, each linking to a page with their name, phone and address.)
 *
 * Signed out: a way to sign in, plus the orders placed from this browser.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer) return <GuestAccount authEnabled={features.googleAuth} />;

  const [loyalty, orders, subscriptions, drinks] = await Promise.all([
    loyaltyFor(viewer.user.id),
    listOrdersForUser(viewer.user.id, viewer.demo ? null : viewer.user.email),
    listSubscriptions(viewer.user.id),
    listDrinks(),
  ]);
  if (!loyalty) return <GuestAccount authEnabled={features.googleAuth} />;

  const { user, ...view } = loyalty;
  const now = Date.now();
  // The list needs a label, not a route: the stage is derived here, and the
  // plan and road geometry (thousands of points each) stay on the server.
  const summaries: AccountOrder[] = await Promise.all(
    orders.map(async (o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total,
      placedAt: o.placedAt,
      stage:
        o.status === 'cancelled'
          ? ('cancelled' as const)
          : deriveTrackingState(await withDerivedPlan(o), now).currentStage,
      items: o.items.map((i) => ({ id: i.id, quantity: i.quantity, name: i.nameSnapshot })),
    })),
  );

  return (
    <Account
      user={user}
      loyalty={view}
      orders={summaries}
      subscriptions={subscriptions}
      drinkNames={Object.fromEntries(drinks.map((d) => [d.id, d.name]))}
      initialTab={tab}
      signedIn={!viewer.demo}
      isAdmin={viewer.isAdmin}
    />
  );
}
