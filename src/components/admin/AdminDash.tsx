'use client';
/**
 * /admin (Blueprint §2.2, §8.4, §14.6).
 *
 * NO scroll animation at all, and a 120ms fade for the route transition. Data
 * tables must be instantly readable and sortable; the motion budget is spent
 * on the guest experience, on purpose.
 */
import { useCallback, useMemo, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { ORDER_STAGE_COPY } from '@/domain/state-machine';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import type { Drink, Order, Reservation } from '@/domain/types';

type Tab = 'payments' | 'orders' | 'reservations' | 'catalogue';

export function AdminDash({
  initialOrders,
  reservations,
  drinks,
  backend,
}: {
  initialOrders: Order[];
  reservations: Reservation[];
  drinks: Drink[];
  backend: string;
}) {
  const [tab, setTab] = useState<Tab>('payments');
  const [orders, setOrders] = useState(initialOrders);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: 'placedAt' | 'total'; dir: 1 | -1 }>({
    key: 'placedAt',
    dir: -1,
  });

  const pending = useMemo(
    () => orders.filter((o) => o.paymentMethod === 'upi' && o.paymentStatus === 'pending'),
    [orders],
  );

  const sorted = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const va = sort.key === 'total' ? a.total : new Date(a.placedAt).getTime();
        const vb = sort.key === 'total' ? b.total : new Date(b.placedAt).getTime();
        return (va - vb) * sort.dir;
      }),
    [orders, sort],
  );

  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((a, o) => a + o.total, 0);

  const verify = useCallback(async (orderNumber: string) => {
    setVerifying(orderNumber);
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/verify-payment`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Could not verify.', 'error');
        return;
      }
      setOrders((prev) => prev.map((o) => (o.orderNumber === orderNumber ? data.order : o)));
      toast(`${orderNumber} confirmed — the delivery plan and route were written.`, 'success');
    } finally {
      setVerifying(null);
    }
  }, []);

  return (
    <div className="shell admin">
      <header className="row-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <p className="eyebrow">Back of house</p>
          <h1 style={{ fontSize: 'var(--text-xl)' }}>Admin</h1>
        </div>
        <span className="badge badge--muted">{backend}</span>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <p className="stat__value">{orders.length}</p>
          <p className="stat__label">Orders</p>
        </div>
        <div className="stat">
          <p className="stat__value">{formatMoney(revenue)}</p>
          <p className="stat__label">Gross</p>
        </div>
        <div className="stat">
          <p className="stat__value">{pending.length}</p>
          <p className="stat__label">UPI awaiting verify</p>
        </div>
        <div className="stat">
          <p className="stat__value">{reservations.filter((r) => r.status === 'booked').length}</p>
          <p className="stat__label">Live reservations</p>
        </div>
      </div>

      <div className="admin-tabs">
        {(['payments', 'orders', 'reservations', 'catalogue'] as Tab[]).map((t) => (
          <button key={t} className="chip" data-active={tab === t || undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'payments' ? (
        pending.length === 0 ? (
          <EmptyState title="Nothing waiting." body="Every UPI transfer has been matched and confirmed." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Guest</th>
                  <th>UTR</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.orderNumber}</td>
                    <td className="mono">{new Date(o.placedAt).toLocaleString('en-IN')}</td>
                    <td>{o.guestEmail}</td>
                    <td className="mono">{o.upiTransactionRef ?? '—'}</td>
                    <td className="mono">{formatMoney(o.total)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={verifying === o.orderNumber}
                        onClick={() => verify(o.orderNumber)}
                      >
                        Verify transfer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11, marginTop: 'var(--space-4)' }}>
              This is the only path in the entire system that can confirm a UPI order. It sets
              payment_status, status and confirmed_at, writes the delivery plan, calls OSRM once,
              and accrues loyalty — in one transaction.
            </p>
          </div>
        )
      ) : null}

      {tab === 'orders' ? (
        orders.length === 0 ? (
          <EmptyState title="No orders yet." body="Place one from the guest side and it appears here." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>
                    <button
                      className="tab"
                      style={{ padding: 0 }}
                      onClick={() =>
                        setSort((s) => ({ key: 'placedAt', dir: s.key === 'placedAt' && s.dir === -1 ? 1 : -1 }))
                      }
                    >
                      Placed {sort.key === 'placedAt' ? (sort.dir === -1 ? '↓' : '↑') : ''}
                    </button>
                  </th>
                  <th>Stage</th>
                  <th>Pay</th>
                  <th>Route</th>
                  <th>
                    <button
                      className="tab"
                      style={{ padding: 0 }}
                      onClick={() =>
                        setSort((s) => ({ key: 'total', dir: s.key === 'total' && s.dir === -1 ? 1 : -1 }))
                      }
                    >
                      Total {sort.key === 'total' ? (sort.dir === -1 ? '↓' : '↑') : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.orderNumber}</td>
                    <td className="mono">{new Date(o.placedAt).toLocaleString('en-IN')}</td>
                    <td>{ORDER_STAGE_COPY[o.derivedStage ?? o.status]?.label}</td>
                    <td>
                      {o.paymentMethod} · {o.paymentStatus}
                    </td>
                    <td className="mono">{o.routeSource ?? '—'}</td>
                    <td className="mono">{formatMoney(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'reservations' ? (
        reservations.length === 0 ? (
          <EmptyState title="No bookings." body="Slots are generated 21 days ahead." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>When</th>
                  <th>Room</th>
                  <th>Guest</th>
                  <th>Party</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.reference}</td>
                    <td className="mono">
                      {r.slot?.slotDate} {r.slot?.slotTime}
                    </td>
                    <td>{r.store?.name}</td>
                    <td>{r.guestName}</td>
                    <td className="mono">{r.partySize}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'catalogue' ? (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Drink</th>
                <th>Category</th>
                <th>Roast</th>
                <th>Caffeine</th>
                <th>Base price</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {drinks.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.category}</td>
                  <td>{d.roast ?? '—'}</td>
                  <td className="mono">{d.caffeineMg}mg</td>
                  <td className="mono">{formatMoney(d.basePrice)}</td>
                  <td>{d.isAvailable ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div style={{ height: 'var(--space-9)' }} />
    </div>
  );
}
