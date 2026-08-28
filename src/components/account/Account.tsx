'use client';
/**
 * /account (Blueprint §13.4, §14.6).
 *
 * Tab ↔ tab is NOT navigation: content cross-fades in place and the active-tab
 * underline slides between labels under --ease-aura, 240ms. No page transition,
 * no reload, no route change.
 *
 * The loyalty Halo animates from 0 to current on FIRST VIEW ONLY.
 */
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { TIERS, type LoyaltyView } from '@/domain/loyalty';
import { ORDER_STAGE_COPY } from '@/domain/state-machine';
import { Halo } from '@/components/motion/Halo';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import type { Order, Subscription, User } from '@/domain/types';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'details', label: 'Saved details' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function Account({
  user,
  loyalty,
  orders,
  subscriptions: initialSubs,
  initialTab,
}: {
  user: User;
  loyalty: LoyaltyView;
  orders: Order[];
  subscriptions: Subscription[];
  initialTab?: string;
}) {
  const [tab, setTab] = useState<TabId>(
    (TABS.find((t) => t.id === initialTab)?.id ?? 'orders') as TabId,
  );
  const [subs, setSubs] = useState(initialSubs);
  const [haloProgress, setHaloProgress] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  // First view only.
  useEffect(() => {
    if (tab !== 'loyalty') return;
    const t = setTimeout(() => setHaloProgress(loyalty.overallProgress), 120);
    return () => clearTimeout(t);
  }, [tab, loyalty.overallProgress]);

  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!el) return;
    setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab]);

  const patchSub = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? 'That did not work.', 'error');
      return;
    }
    setSubs((prev) => prev.map((s) => (s.id === data.subscription.id ? data.subscription : s)));
    toast('Updated.', 'success');
  }, []);

  return (
    <div className="shell account">
      <header className="page-head">
        <p className="eyebrow">Signed in as</p>
        <h1>{user.name}</h1>
        <p className="muted">{user.email}</p>
      </header>

      <div className="tabs" role="tablist" ref={tabsRef}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            data-tab={t.id}
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span
          className="tabs__underline"
          style={{ transform: `translateX(${underline.left}px)`, width: underline.width }}
          aria-hidden="true"
        />
      </div>

      <div key={tab} className="account__panel" style={{ paddingTop: 'var(--space-6)' }}>
        {tab === 'orders' ? (
          orders.length === 0 ? (
            <EmptyState
              title="No orders yet."
              body="Your first one takes about forty seconds to build."
              action={{ href: '/menu', label: 'Open the menu' }}
            />
          ) : (
            <Reveal variant="stagger" stagger={0.05} className="stack">
              {orders.map((o) => (
                <Link key={o.id} href={`/track/${o.orderNumber}`} className="store-row">
                  <div className="row-between">
                    <strong className="mono">{o.orderNumber}</strong>
                    <span className="mono">{formatMoney(o.total)}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {o.items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(', ')}
                  </p>
                  <p className="mono muted" style={{ fontSize: 11 }}>
                    {ORDER_STAGE_COPY[o.derivedStage ?? o.status]?.label} ·{' '}
                    {new Date(o.placedAt).toLocaleDateString('en-IN')}
                  </p>
                </Link>
              ))}
            </Reveal>
          )
        ) : null}

        {tab === 'subscriptions' ? (
          subs.length === 0 ? (
            <EmptyState
              title="No standing order."
              body="Weekly, biweekly or monthly. Pause it any time, skip a delivery without cancelling."
              action={{ href: '/menu?category=beans', label: 'Pick a bean' }}
            />
          ) : (
            <Reveal variant="stagger" stagger={0.05} className="stack">
              {subs.map((s) => (
                <article key={s.id} className="card">
                  <div className="row-between">
                    <strong>{s.drinkId ? 'Chikmagalur Washed · 250g' : 'Surprise me'}</strong>
                    <span className="badge badge--aura">{s.status}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {s.cadence} · {s.quantity} bag{s.quantity > 1 ? 's' : ''} · next{' '}
                    {new Date(s.nextDelivery).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  <div className="row wrap" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    <Button size="sm" onClick={() => patchSub({ id: s.id, skip: true })}>
                      Skip next
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patchSub({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' })
                      }
                    >
                      {s.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => patchSub({ id: s.id, status: 'cancelled' })}>
                      Cancel
                    </Button>
                  </div>
                </article>
              ))}
            </Reveal>
          )
        ) : null}

        {tab === 'loyalty' ? (
          <div className="stack">
            <div className="row" style={{ gap: 'var(--space-7)', flexWrap: 'wrap' }}>
              {/* The four tiers ARE the four quadrants of the Halo (§1.3 #2). */}
              <Halo
                size={200}
                stroke={3}
                progress={haloProgress}
                quadrants
                activeQuadrant={loyalty.tier.quadrant}
                label={`${loyalty.tier.tier} tier`}
              >
                <div className="stack-sm" style={{ gap: 2, textAlign: 'center' }}>
                  <span
                    className="mono"
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--smoke-400)', letterSpacing: '0.18em' }}
                  >
                    TIER
                  </span>
                  <strong style={{ fontFamily: 'var(--font-display), serif', fontSize: 'var(--text-lg)' }}>
                    {loyalty.tier.tier}
                  </strong>
                </div>
              </Halo>

              <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
                <p className="eyebrow">{loyalty.lifetimePoints} lifetime points</p>
                <p className="lede">{loyalty.tier.blurb}</p>
                {loyalty.next ? (
                  <p className="muted">
                    {loyalty.pointsToNext} points to <strong>{loyalty.next.tier}</strong>.
                  </p>
                ) : (
                  <p className="muted">Top tier. The Halo is closed.</p>
                )}
                <p className="mono muted" style={{ fontSize: 10, marginTop: 'var(--space-3)' }}>
                  Tier is derived on read from lifetime_points. It is stored in no table — if the
                  two ever disagreed there would be nothing to disagree with.
                </p>
              </div>
            </div>

            <Reveal variant="flip" stagger={0.07} className="tier-grid">
              {TIERS.map((t) => (
                <div
                  key={t.tier}
                  className="tier-card"
                  data-reached={loyalty.lifetimePoints >= t.pointsThreshold || undefined}
                  data-current={t.tier === loyalty.tier.tier || undefined}
                >
                  <div className="row-between">
                    <strong>{t.tier}</strong>
                    <span className="mono muted" style={{ fontSize: 11 }}>
                      {t.pointsThreshold}
                    </span>
                  </div>
                  <ul className="stack-sm" style={{ marginTop: 'var(--space-3)' }}>
                    {t.perks.map((p) => (
                      <li key={p} className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                        · {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Reveal>
          </div>
        ) : null}

        {tab === 'details' ? (
          <div className="stack">
            <div className="card stack-sm">
              <p className="field__label">Referral code</p>
              <div className="row-between">
                <span className="mono" style={{ fontSize: 'var(--text-lg)', color: 'var(--aura-500)' }}>
                  {user.referralCode}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(user.referralCode);
                    toast('Code copied', 'success');
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Both sides earn 140 points on their first order.
              </p>
            </div>
            <div className="card stack-sm">
              <p className="field__label">Locale &amp; currency</p>
              <p className="mono">
                {user.locale} · {user.currency}
              </p>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Scaffolded from day one rather than retrofitted. Money is stored as integer paise
                everywhere, so a second currency is a formatting change, not a migration.
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
