import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getOrderByNumber } from '@/repositories';
import { upiPayload } from '@/services/payment';
import { Confirmation } from '@/components/checkout/Confirmation';

export const metadata: Metadata = { title: 'Order confirmed' };
export const dynamic = 'force-dynamic';

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;
  if (!orderNumber) redirect('/menu');

  const order = await getOrderByNumber(orderNumber);
  if (!order) redirect('/menu');

  let qrSvg: string | null = null;
  let upi: { uri: string; upiId: string; payeeName: string } | null = null;

  if (order.paymentMethod === 'upi') {
    const payload = upiPayload(order.orderNumber, order.total);
    upi = { uri: payload.uri, upiId: payload.upiId, payeeName: payload.payeeName };
    // Generated locally — no gateway, no API, no network call (§8.3).
    const QRCode = (await import('qrcode')).default;
    qrSvg = await QRCode.toString(payload.uri, {
      type: 'svg',
      margin: 1,
      color: { dark: '#1A1310', light: '#F0E8DA' },
    });
  }

  return <Confirmation order={order} upi={upi} qrSvg={qrSvg} />;
}
