import type { Metadata } from 'next';
import { DEMO_USER_ID, listSubscriptions, loyaltyFor } from '@/repositories';
import { recentOrders } from '@/services/order';
import { Account } from '@/components/account/Account';

export const metadata: Metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, loyalty, orders, subscriptions] = await Promise.all([
    searchParams,
    loyaltyFor(DEMO_USER_ID),
    recentOrders(),
    listSubscriptions(DEMO_USER_ID),
  ]);

  if (!loyalty) return null;
  const { user, ...view } = loyalty;

  return (
    <Account
      user={user}
      loyalty={view}
      orders={orders}
      subscriptions={subscriptions}
      initialTab={tab}
    />
  );
}
