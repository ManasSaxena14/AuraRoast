'use client';
/**
 * The cart is an OVERLAY, not a route (§13.7). It slides in 320ms
 * `--ease-aura`, out 200ms `--ease-settle`, backdrop fading in parallel. Body
 * scroll is locked AND Lenis is stopped while open — `overflow: hidden` alone
 * does not stop Lenis, and the result is a modal that scrolls the page behind
 * it (§14.2).
 */
import Link from 'next/link';
import Image from '@/components/ui/SmartImage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { describeSelection } from '@/domain/brew-plan';
import { lockScroll, unlockScroll } from '@/components/motion/SmoothScroll';
import { Button } from '@/components/ui/Button';
import { EmptyState, Stepper } from '@/components/ui/bits';
import { suggestPairings } from '@/data/pairings';
import { toast } from '@/components/toast/ToastProvider';
import { loginHref, useAuthGate } from '@/components/auth/useAuthGate';
import { useCart } from './CartProvider';

export function CartDrawer() {
  const { isOpen, close, lines, priced, setQuantity, remove, fulfillment, setFulfillment, addLine } = useCart();
  /* Plates tasted against what is in the cart. Only offered once there is a
     drink to pair against — a cart of biscuits does not need more biscuits. */
  const hasDrink = lines.some((l) => !l.lineId.startsWith('pairing-'));
  // Checking out needs an account; the cart is kept in the browser meanwhile.
  const gate = useAuthGate();
  const suggestions = useMemo(() => (hasDrink ? suggestPairings(lines, 3) : []), [hasDrink, lines]);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    restoreFocus.current = document.activeElement as HTMLElement;
    lockScroll();
    panelRef.current?.querySelector<HTMLElement>('button, a, input')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Focus trap.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      restoreFocus.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function startClose() {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      close();
    }, 200);
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="overlay-backdrop" onClick={startClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className="drawer"
        data-closing={closing || undefined}
        // Lenis is stopped while the drawer is open, and a stopped Lenis
        // cancels EVERY wheel event on the page — including the ones meant
        // to scroll this drawer. This attribute exempts it.
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
      >
        <header className="drawer__head row-between">
          <div className="stack-sm">
            <p className="eyebrow" style={{ marginBottom: 0 }}>
              Your cart
            </p>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {lines.length ? `${lines.length} line${lines.length > 1 ? 's' : ''}` : 'Nothing yet'}
            </p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={startClose} aria-label="Close cart">
            ✕
          </button>
        </header>

        <div className="drawer__body">
          {lines.length === 0 ? (
            <EmptyState
              title="Empty, for now."
              body="Five origins, sixteen ways to drink them. Start anywhere."
              action={{ href: '/menu', label: 'Open the menu' }}
            />
          ) : (
            lines.map((line, i) => {
              const pricedLine = priced.lines.find((p) => p.lineId === line.lineId);
              return (
                <article
                  key={line.lineId}
                  className="cart-line"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <div className="cart-line__media">
                    <Image src={line.imageUrl} alt="" width={120} height={120} sizes="68px" />
                  </div>
                  <div className="cart-line__body">
                    <div className="row-between" style={{ alignItems: 'flex-start' }}>
                      <Link href={`/menu/${line.slug}`} onClick={startClose} className="cart-line__name">
                        {line.name}
                      </Link>
                      <span className="mono">{formatMoney(pricedLine?.lineTotal ?? 0)}</span>
                    </div>
                    {line.modifiers.length ? (
                      <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {describeSelection(line.modifiers) || 'As it comes'}
                      </p>
                    ) : null}
                    <div className="row-between">
                      <Stepper
                        value={line.quantity}
                        onChange={(v) => setQuantity(line.lineId, v)}
                        min={0}
                        label={line.name}
                      />
                      <button className="btn btn--ghost btn--sm" onClick={() => remove(line.lineId)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {suggestions.length ? (
            <section className="pair-suggest" aria-label="Goes well with your order">
              <div className="row-between">
                <p className="eyebrow" style={{ marginBottom: 0 }}>
                  Goes well with
                </p>
                <Link href="/pairings" onClick={startClose} className="link-arrow" style={{ fontSize: 'var(--text-xs)' }}>
                  All plates
                </Link>
              </div>
              <div className="pair-suggest__row">
                {suggestions.map((p, i) => (
                  <article key={p.id} className="pair-suggest__card" style={{ '--i': i } as React.CSSProperties}>
                    <div className="pair-suggest__media">
                      <Image src={p.imageUrl} alt="" width={240} height={180} sizes="120px" />
                    </div>
                    <p className="pair-suggest__name">{p.name}</p>
                    <div className="row-between" style={{ gap: 6 }}>
                      <span className="mono pair-suggest__price">{formatMoney(p.price)}</span>
                      <button
                        type="button"
                        className="pair-suggest__add"
                        aria-label={`Add ${p.name}`}
                        onClick={() => {
                          addLine({ id: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, price: p.price });
                          toast(`${p.name} added`, 'success');
                        }}
                      >
                        +
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <footer className="drawer__foot stack-sm">
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <button
                className="chip"
                data-active={fulfillment === 'delivery' || undefined}
                onClick={() => setFulfillment('delivery')}
              >
                Delivery
              </button>
              <button
                className="chip"
                data-active={fulfillment === 'pickup' || undefined}
                onClick={() => setFulfillment('pickup')}
              >
                Pickup
              </button>
            </div>
            <div className="row-between">
              <span className="muted">Subtotal</span>
              <span className="mono">{formatMoney(priced.subtotal)}</span>
            </div>
            <div className="row-between">
              <span className="muted">Tax · GST 5%</span>
              <span className="mono">{formatMoney(priced.tax)}</span>
            </div>
            <div className="row-between">
              <span className="muted">
                {fulfillment === 'pickup' ? 'Pickup' : priced.deliveryFee === 0 ? 'Delivery · free over ₹799' : 'Delivery'}
              </span>
              <span className="mono">{formatMoney(priced.deliveryFee)}</span>
            </div>
            <hr className="rule" />
            <div className="row-between">
              <strong>Total</strong>
              <strong className="mono" style={{ color: 'var(--aura-500)' }}>
                {formatMoney(priced.total)}
              </strong>
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Re-priced on the server before checkout. This number is a preview.
            </p>
            <Link
              href={gate === 'out' ? loginHref('/checkout') : '/checkout'}
              onClick={startClose}
              className="btn btn--primary btn--block btn--lg"
            >
              {gate === 'out' ? 'Sign in to check out' : 'Checkout'}
            </Link>
            {gate === 'out' ? (
              <p className="muted" style={{ fontSize: 11, textAlign: 'center' }}>
                Your cart is saved — it will be right here after you sign in.
              </p>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </>
  );
}
