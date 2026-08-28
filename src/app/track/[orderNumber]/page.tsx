import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOrderByNumber } from '@/repositories';
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
  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();
  return <Tracker order={order} />;
}
