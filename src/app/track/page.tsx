import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { findLatestOrderByContact, getOrderByNumber } from '@/repositories';
import { normaliseOrderNumber } from '@/lib/ids';
import { Reveal } from '@/components/motion/Reveal';
import { Field } from '@/components/ui/Field';

export const metadata: Metadata = {
  title: 'Track an order',
  description: 'Enter your order number to follow the cup from the bar to the door.',
};
export const dynamic = 'force-dynamic';

/**
 * The landing half of /track (Blueprint §7.4). The lookup runs on the server
 * BEFORE the redirect, so a wrong number comes back as a correction on this
 * form rather than as the site-wide 404.
 *
 * A guest who has lost the number can use the EXACT email or phone they gave
 * at checkout — the same proof every order endpoint asks for. This used to
 * substring-match the last fifty orders on email, phone and address, so
 * typing "gmail" or a pincode opened a stranger's order with their name,
 * phone and address on it.
 */
export default async function TrackLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const raw = (order ?? '').trim().slice(0, 200);

  let found: string | null = null;
  if (raw) {
    const byNumber = await getOrderByNumber(normaliseOrderNumber(raw));
    if (byNumber) {
      found = byNumber.orderNumber;
    } else if (raw.includes('@') || raw.replace(/\D/g, '').length >= 10) {
      found = (await findLatestOrderByContact(raw))?.orderNumber ?? null;
    }
  }
  // redirect() throws, so it stays out of anything that could swallow it.
  if (found) redirect(`/track/${found}`);

  const looksLikeContact = raw.includes('@') || raw.replace(/\D/g, '').length >= 10;

  return (
    <div className="shell">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Where is it</p>
        </Reveal>
        <h1>Follow the cup.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Your order number is on the confirmation screen — AT- and six characters. Lost it? The
            email or phone number you ordered with finds your latest order too.
          </p>
        </Reveal>
      </header>

      <form method="get" className="stack" style={{ maxWidth: 380 }}>
        <Field
          label="Order number, email or phone"
          name="order"
          defaultValue={raw}
          placeholder="AT-7K3M9Q"
          hint="The AT- is optional."
          error={
            raw
              ? looksLikeContact
                ? 'No order was placed with that email or phone.'
                : `No order matches ${normaliseOrderNumber(raw)}. Check the number and try again.`
              : null
          }
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button type="submit" className="btn btn--primary btn--block">
          Track this order
        </button>
        <Link href="/account" className="btn btn--outline btn--block">
          See your orders
        </Link>
      </form>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
