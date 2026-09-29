'use client';
/**
 * "Send me this every fortnight" — on whole-bean pages only.
 *
 * A standing order belongs to an account, so a signed-out guest gets the way
 * to sign in (and straight back here) instead of a form that can only fail.
 */
import Link from 'next/link';
import { useContext, useState } from 'react';
import { SessionContext } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import type { SubscriptionCadence } from '@/domain/types';

const CADENCES: { id: SubscriptionCadence; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly' },
];

export function SubscribeCard({ drinkId, drinkName, slug }: { drinkId: string; drinkName: string; slug: string }) {
  const session = useContext(SessionContext);
  const [cadence, setCadence] = useState<SubscriptionCadence>('biweekly');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // No provider means sign-in is off here (local demo mode), where the API
  // answers for the demo profile — so the form is offered either way.
  const signedOut = session !== undefined && session.status === 'unauthenticated';

  async function subscribe() {
    setBusy(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drinkId, cadence, quantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? 'That did not go through.', 'error');
        return;
      }
      setDone(true);
      toast(`${drinkName} is on its way, ${CADENCES.find((c) => c.id === cadence)?.label.toLowerCase()}.`, 'success');
    } catch {
      toast('The connection dropped — nothing was set up.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack subscribe-card" aria-labelledby="subscribe-title">
      <div className="stack-sm">
        <p className="eyebrow" style={{ marginBottom: 0 }}>Standing order</p>
        <h2 id="subscribe-title" style={{ fontSize: 'var(--text-lg)' }}>
          Never run out of {drinkName}.
        </h2>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Roasted the week it ships. Pause, skip a delivery or cancel from your account, any time.
        </p>
      </div>

      {done ? (
        <div className="row wrap" style={{ gap: 'var(--space-3)' }}>
          <p className="mono" style={{ color: 'var(--verdant-500)' }}>✓ Subscribed</p>
          <Link href="/account?tab=subscriptions" className="link-arrow">
            Manage it <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : signedOut ? (
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/menu/${slug}`)}`} className="btn btn--outline">
          Sign in to subscribe
        </Link>
      ) : (
        <>
          <div className="row wrap" role="radiogroup" aria-label="How often" style={{ gap: 'var(--space-2)' }}>
            {CADENCES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={cadence === c.id}
                className="chip"
                data-active={cadence === c.id || undefined}
                onClick={() => setCadence(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="row-between">
            <Stepper value={quantity} onChange={setQuantity} min={1} max={4} label="bags" />
            <Button variant="primary" loading={busy} onClick={() => void subscribe()}>
              Subscribe · {quantity} × 250g
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
