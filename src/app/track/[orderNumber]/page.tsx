import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOrderByNumber } from '@/repositories';
import { deriveTrackingState } from '@/domain/tracking';
import { Tracker } from '@/components/track/Tracker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Tracking ${orderNumber}` };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  let order = await getOrderByNumber(orderNumber);
  if (!order) {
    await new Promise((r) => setTimeout(r, 600));
    order = await getOrderByNumber(orderNumber);
  }
  if (!order) notFound();

  // Derived here, not left to the client's first poll: nothing ever advances
  // the stored `status` column, so without this the page first paints
  // "Order received / 0 %" for an order that was delivered an hour ago (§7.4).
  // `contact` lets the client prove ownership on the guarded track/cancel
  // routes — it is the guest's own email, on the guest's own order page.
  return (
    <Tracker
      order={order}
      initialState={deriveTrackingState(order, Date.now())}
      contact={order.guestEmail ?? order.guestPhone}
    />
  );
}
