import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getOrderByNumber } from '@/repositories';
import { Reveal } from '@/components/motion/Reveal';
import { Field } from '@/components/ui/Field';

export const metadata: Metadata = {
  title: 'Track an order',
  description: 'Enter your order number to follow the cup from the bar to the door.',
};

/** Guests read the number off a receipt and routinely drop the `AT-` prefix. */
function normalise(raw: string): string {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^\d+$/.test(value) ? `AT-${value.padStart(6, '0')}` : value;
}

/**
 * The landing half of /track (Blueprint §7.4). The header links here, and a
 * guest arriving from an email with nothing but the number needs somewhere to
 * type it. The lookup runs on the server BEFORE the redirect, so a wrong
 * number comes back as a correction on this form rather than as the site-wide
 * 404 the bare /track/[orderNumber] route would give.
 */
export default async function TrackLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const submitted = order ? normalise(order) : '';
  const found = submitted ? await getOrderByNumber(submitted) : null;
  // redirect() throws, so it stays out of anything that could swallow it.
  if (found) redirect(`/track/${found.orderNumber}`);

  return (
    <div className="shell">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Where is it</p>
        </Reveal>
        <h1>Follow the cup.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Your order number is on the confirmation screen and in the email — six digits after
            the AT-. Nothing about the tracking page expires, so the link keeps answering long
            after the order lands.
          </p>
        </Reveal>
      </header>

      <form method="get" className="stack" style={{ maxWidth: 380 }}>
        <Field
          label="Order number"
          name="order"
          defaultValue={submitted}
          placeholder="AT-001042"
          hint="Type the digits alone and we will add the AT-."
          error={submitted ? `No order matches ${submitted}. Check the number and try again.` : null}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button type="submit" className="btn btn--primary btn--block">
          Track this order
        </button>
        <Link href="/account" className="btn btn--outline btn--block">
          See recent orders
        </Link>
      </form>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
