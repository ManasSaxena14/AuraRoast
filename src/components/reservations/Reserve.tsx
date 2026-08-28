'use client';
/**
 * /reservations (Blueprint §9.2, §14.6).
 *
 * The slot grid re-staggers on date change and the summary card is sticky.
 * The interesting part is not the motion though — it is that a full slot is
 * disabled WITH THE REASON SHOWN INLINE (Part 15), and that the booking itself
 * goes through one atomic statement, so two guests racing for the last seat
 * cannot both win. The 409 you may see here is that guard doing its job.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { MAX_PARTY_SIZE, bookableDates } from '@/domain/slots';
import { Reveal } from '@/components/motion/Reveal';
import { Halo } from '@/components/motion/Halo';
import { Button } from '@/components/ui/Button';
import { Field, SelectField, TextareaField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/bits';
import { toast } from '@/components/toast/ToastProvider';
import { storesByCity } from '@/data/stores';
import type { Reservation, Store } from '@/domain/types';

interface SlotView {
  id: string;
  time: string;
  capacity: number;
  remaining: number;
  state: 'available' | 'tight' | 'full' | 'past';
  eventTitle?: string;
  eventPrice?: number;
}

interface EventView {
  id: string;
  date: string;
  time: string;
  title: string;
  price: number;
  capacity: number;
  remaining: number;
  state: SlotView['state'];
  store: Store | null;
}

export function Reserve({ stores }: { stores: Store[] }) {
  const [tab, setTab] = useState<'table' | 'event'>('table');
  const dates = useMemo(() => bookableDates(new Date(), 14), []);
  const cityGroups = useMemo(() => storesByCity(stores), [stores]);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [date, setDate] = useState(dates[0]);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setSelected(null);
    (async () => {
      const res = await fetch(`/api/reservations/availability?storeId=${storeId}&date=${date}`);
      const data = await res.json();
      if (!cancelled) setSlots(data.slots ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, date]);

  useEffect(() => {
    if (tab !== 'event' || events) return;
    (async () => {
      const res = await fetch('/api/reservations/availability?type=event');
      const data = await res.json();
      setEvents(data.events ?? []);
    })();
  }, [tab, events]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selected) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: selected,
            guestName: name,
            guestEmail: email,
            guestPhone: phone,
            partySize,
            notes,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // 409 here is the atomic capacity check refusing to overbook (§9.2).
          setError(data.error ?? 'That did not go through.');
          toast(data.error ?? 'That slot just went.', 'error');
          // Re-read availability so the grid tells the truth immediately.
          const fresh = await fetch(`/api/reservations/availability?storeId=${storeId}&date=${date}`);
          setSlots((await fresh.json()).slots ?? []);
          setSelected(null);
          return;
        }
        setConfirmed(data.reservation);
      } finally {
        setBusy(false);
      }
    },
    [selected, name, email, phone, partySize, notes, storeId, date],
  );

  if (confirmed) {
    return (
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', paddingBlock: 'var(--space-9)' }}>
        <Halo size={140} stroke={2} progress={1} label="Reservation confirmed" />
        <h2>Table held.</h2>
        <p className="lede" style={{ marginInline: 'auto' }}>
          {confirmed.guestName}, {confirmed.partySize} {confirmed.partySize === 1 ? 'person' : 'people'} —{' '}
          {confirmed.slot?.slotDate} at {confirmed.slot?.slotTime}, {confirmed.store?.name}.
        </p>
        <p className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--aura-500)' }}>
          {confirmed.reference}
        </p>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Keep the reference. It is the only thing we need to find you.
        </p>
        <Button variant="outline" onClick={() => { setConfirmed(null); setSelected(null); }}>
          Book another
        </Button>
      </div>
    );
  }

  return (
    <div className="reserve-layout">
      <div className="stack">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            className="tab"
            aria-selected={tab === 'table'}
            onClick={() => setTab('table')}
          >
            Tables
          </button>
          <button
            role="tab"
            className="tab"
            aria-selected={tab === 'event'}
            onClick={() => setTab('event')}
          >
            Cuppings &amp; classes
          </button>
        </div>

        {tab === 'table' ? (
          <>
            <SelectField
              label="Room"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              hint={stores.find((s) => s.id === storeId)?.blurb}
            >
              {cityGroups.map((g) => (
                <optgroup key={g.slug} label={g.name}>
                  {g.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>

            <div className="stack-sm">
              <span className="field__label">Date</span>
              <div className="date-scroller">
                {dates.map((d) => {
                  const dd = new Date(`${d}T00:00:00`);
                  return (
                    <button
                      key={d}
                      className="date-pill"
                      data-selected={d === date || undefined}
                      onClick={() => setDate(d)}
                    >
                      <small>{dd.toLocaleDateString('en-IN', { weekday: 'short' })}</small>
                      {dd.getDate()}
                      <small>{dd.toLocaleDateString('en-IN', { month: 'short' })}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="stack-sm">
              <span className="field__label">Time · 30-minute slots</span>
              {slots === null ? (
                <div className="slot-grid">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 56 }} />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <EmptyState title="Nothing that day." body="Try another date, or another room." />
              ) : (
                <Reveal key={`${storeId}-${date}`} variant="stagger" stagger={0.012} className="slot-grid">
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      className="slot"
                      data-selected={selected === s.id || undefined}
                      disabled={s.state === 'full' || s.state === 'past'}
                      onClick={() => setSelected(s.id)}
                    >
                      {s.time}
                      {/* Disabled WITH the reason shown, not just greyed out. */}
                      <small>
                        {s.state === 'full'
                          ? 'Full'
                          : s.state === 'past'
                            ? 'Gone'
                            : s.state === 'tight'
                              ? `${s.remaining} left`
                              : `${s.remaining} seats`}
                      </small>
                    </button>
                  ))}
                </Reveal>
              )}
            </div>
          </>
        ) : (
          <div className="stack">
            {events === null ? (
              <div className="stack">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 96 }} />
                ))}
              </div>
            ) : events.length === 0 ? (
              <EmptyState title="Nothing scheduled." body="Cuppings run Saturdays, brew classes Wednesdays. Check back." />
            ) : (
              <Reveal variant="stagger" stagger={0.05} className="stack">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    className="store-row"
                    data-active={selected === ev.id || undefined}
                    disabled={ev.state === 'full' || ev.state === 'past'}
                    onClick={() => setSelected(ev.id)}
                    style={{ textAlign: 'left' }}
                  >
                    <div className="row-between">
                      <h3 style={{ fontSize: 'var(--text-base)' }}>{ev.title}</h3>
                      <span className="mono" style={{ color: 'var(--aura-500)' }}>
                        {formatMoney(ev.price)}
                      </span>
                    </div>
                    <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                      {new Date(`${ev.date}T${ev.time}`).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      at {ev.time} · {ev.store?.name}
                    </p>
                    <p className="mono muted" style={{ fontSize: 11 }}>
                      {ev.state === 'full' ? 'Full' : `${ev.remaining} of ${ev.capacity} places left`}
                    </p>
                  </button>
                ))}
              </Reveal>
            )}
          </div>
        )}
      </div>

      <form className="card reserve-summary stack" onSubmit={submit}>
        <div className="row-between">
          <p className="eyebrow" style={{ marginBottom: 0 }}>
            Your booking
          </p>
          <Halo size={40} stroke={1.6} progress={selected ? 1 : 0.25} animateOnMount={false} />
        </div>

        <SelectField
          label={tab === 'event' ? 'Places' : 'Party size'}
          value={partySize}
          onChange={(e) => setPartySize(Number(e.target.value))}
        >
          {Array.from({ length: MAX_PARTY_SIZE }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'person' : 'people'}
            </option>
          ))}
        </SelectField>

        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Optional" />
        <TextareaField
          label="Anything we should know"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          hint="Allergies, a birthday, a laptop and three hours"
        />

        {error ? (
          <p className="field__error">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" block loading={busy} disabled={!selected}>
          {selected ? 'Hold the table' : 'Pick a time first'}
        </Button>
        <p className="muted" style={{ fontSize: 11 }}>
          Capacity is checked in a single atomic statement, so a slot cannot be double-booked. If
          someone beats you to the last seat you will be told immediately, not after.
        </p>
      </form>
    </div>
  );
}
