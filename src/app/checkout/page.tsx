import type { Metadata } from 'next';
import { listStores } from '@/repositories';
import { paymentSettings } from '@/services/payment';
import { Checkout } from '@/components/checkout/Checkout';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const [stores, payment] = await Promise.all([listStores(), Promise.resolve(paymentSettings())]);
  return (
    <div className="shell">
      <header className="page-head" style={{ paddingBottom: 'var(--space-4)' }}>
        <p className="eyebrow">Almost there</p>
        <h1>Checkout.</h1>
      </header>
      <Checkout stores={stores} payment={payment} />
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
