import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getOrderByNumber } from '@/repositories';
import { withDerivedPlan } from '@/services/order';
import { deriveTrackingState } from '@/domain/tracking';
import { normaliseOrderNumber } from '@/lib/ids';
import { getViewer, ownsOrder, publicOrderView } from '@/lib/session';
import { Tracker } from '@/components/track/Tracker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Tracking ${orderNumber.toUpperCase().slice(0, 16)}`, robots: { index: false } };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber: rawNumber } = await params;
  let decoded = rawNumber;
  try {
    decoded = decodeURIComponent(rawNumber);
  } catch {
    notFound(); // a malformed %-sequence is not an order number
  }
  const wanted = normaliseOrderNumber(decoded);
  // `/track/at7k3m9q` and `/track/1042` land on the canonical URL.
  if (wanted !== rawNumber) redirect(`/track/${wanted}`);

  const [found, viewer] = await Promise.all([getOrderByNumber(wanted), getViewer()]);
  if (!found) notFound();
  const order = await withDerivedPlan(found);

  // Derived here, not left to the client's first poll: nothing ever advances
  // the stored `status` column, so without this the page first paints
  // "Order received / 0 %" for an order that was delivered an hour ago (§7.4).
  //
  // The browser gets the order WITHOUT the guest's email or full phone — the
  // link is shareable. Ownership for cancelling is proven by the signed-in
  // account (server-side) or by the contact kept on the ordering device.
  return (
    <Tracker
      order={publicOrderView(order)}
      initialState={deriveTrackingState(order, Date.now())}
      ownedBySession={ownsOrder(viewer, order)}
    />
  );
}
