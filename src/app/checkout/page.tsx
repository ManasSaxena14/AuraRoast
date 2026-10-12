import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listStores } from '@/repositories';
import { paymentSettings } from '@/services/payment';
import { getViewer } from '@/lib/session';
import { Checkout } from '@/components/checkout/Checkout';

export const metadata: Metadata = { title: 'Checkout' };
// Who is checking out decides whether this page renders at all.
export const dynamic = 'force-dynamic';

/**
 * Ordering needs an account. Signed out, the guest is sent to sign in and
 * brought straight back here — the cart lives in the browser, so nothing in
 * it is lost on the way. The order API refuses an anonymous request too; this
 * redirect is the friendly half of the same rule.
 */
export default async function CheckoutPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?callbackUrl=%2Fcheckout');

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
