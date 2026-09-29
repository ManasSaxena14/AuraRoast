'use client';
/**
 * /account for a guest who has not signed in.
 *
 * Checkout never needs an account, so a guest's orders live in two places:
 * the confirmation email, and this browser. This lists the second, and offers
 * the sign-in that keeps orders, points and subscriptions together.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { Halo } from '@/components/motion/Halo';
import { Reveal } from '@/components/motion/Reveal';
import { EmptyState } from '@/components/ui/bits';
import { deviceOrders, type DeviceOrder } from '@/lib/device-orders';

export function GuestAccount({ authEnabled }: { authEnabled: boolean }) {
  const [orders, setOrders] = useState<DeviceOrder[] | null>(null);

  // localStorage only exists in the browser, so this fills in after mount.
  useEffect(() => setOrders(deviceOrders()), []);

  return (
    <div className="shell account">
      <header className="page-head">
        <p className="eyebrow">Your account</p>
        <h1>Orders, points and standing orders.</h1>
        <p className="lede">
          You never need an account to order. Sign in and every order, loyalty point and
          subscription stays with you, on any device.
        </p>
      </header>

      {authEnabled ? (
        <Reveal variant="rise" className="card account-signin">
          <Halo size={72} stroke={2} progress={0.25} animateOnMount={false} />
          <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
            <strong>Sign in with Google</strong>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              No password to create. Orders placed with the same email appear here automatically.
            </p>
          </div>
          <Link href="/login?callbackUrl=/account" className="btn btn--primary">
            Sign in
          </Link>
        </Reveal>
      ) : null}

      <section className="stack" style={{ marginTop: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Ordered on this device</h2>
        {orders === null ? (
          <div className="stack">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 84 }} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="Nothing from this browser yet."
            body="Orders you place here show up in this list, with a link to follow each one."
            action={{ href: '/menu', label: 'Open the menu' }}
          />
        ) : (
          <Reveal variant="stagger" stagger={0.05} className="stack">
            {orders.map((o) => (
              <Link key={o.orderNumber} href={`/track/${o.orderNumber}`} className="store-row">
                <div className="row-between">
                  <strong className="mono">{o.orderNumber}</strong>
                  <span className="mono">{formatMoney(o.total)}</span>
                </div>
                <p className="mono muted" style={{ fontSize: 11 }}>
                  {new Date(o.placedAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  · Track it →
                </p>
              </Link>
            ))}
          </Reveal>
        )}
        <p className="muted" style={{ fontSize: 11 }}>
          Lost an order number? <Link href="/track" className="link-inline">Find it by email or phone</Link>.
        </p>
      </section>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
