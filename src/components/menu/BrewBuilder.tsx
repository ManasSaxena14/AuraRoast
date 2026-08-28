'use client';
/**
 * The Brew Builder (Blueprint §2.1, Part 15).
 *
 * The builder itself carries NO scroll animation — it is a control surface
 * (§14.6). Its two micro-interactions are deliberate:
 *   · price and caffeine number-ROLL rather than swapping instantly
 *   · the Halo fills as customization completeness increases — a small,
 *     functional signal that says "you have made choices"
 *
 * Pricing is computed client-side for instant feel with the same pure function
 * the server uses, then re-quoted against `/api/menu/quote` so the guest never
 * sees a number the server would disagree with (§9.1).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { priceLine } from '@/domain/pricing';
import { MODIFIER_LABELS, MODIFIER_ORDER, buildPreview } from '@/domain/brew-plan';
import { Halo } from '@/components/motion/Halo';
import { NumberRoll } from '@/components/motion/NumberRoll';
import { Button } from '@/components/ui/Button';
import { IntensityMeter, Stepper } from '@/components/ui/bits';
import { useCart } from '@/components/cart/CartProvider';
import { toast } from '@/components/toast/ToastProvider';
import type { CartLine, Drink, Modifier, SelectedModifier } from '@/domain/types';

export function BrewBuilder({
  drink,
  modifiers,
  defaults,
}: {
  drink: Drink;
  modifiers: Modifier[];
  defaults: SelectedModifier[];
}) {
  const [selected, setSelected] = useState<SelectedModifier[]>(defaults);
  const [quantity, setQuantity] = useState(1);
  /**
   * The server's answer is stored WITH the configuration it priced. Holding
   * just a number means the previous quote keeps showing while a new one is in
   * flight — the guest taps "Long · +₹40" and the price sits still for a round
   * trip, which reads as a broken control rather than a careful one.
   */
  const [serverQuote, setServerQuote] = useState<{ key: string; lineTotal: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const { add, open } = useCart();

  const preview = useMemo(() => buildPreview(drink, selected), [drink, selected]);

  const quoteKey = useMemo(
    () =>
      `${drink.id}|${quantity}|${selected
        .map((m) => `${m.kind}:${m.slug}`)
        .sort()
        .join(',')}`,
    [drink.id, quantity, selected],
  );

  const localLine: CartLine = useMemo(
    () => ({
      lineId: 'builder',
      drinkId: drink.id,
      slug: drink.slug,
      name: drink.name,
      imageUrl: drink.imageUrl,
      quantity,
      modifiers: selected,
    }),
    [drink, quantity, selected],
  );
  const local = useMemo(() => priceLine(drink, localLine), [drink, localLine]);

  // The server is asked for the truth on every change, debounced. The client
  // number stays on screen meanwhile — instant feel, server-owned truth.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch('/api/menu/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drinkId: drink.id, modifiers: selected, quantity }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { lineTotal: number };
        if (!cancelled) setServerQuote({ key: quoteKey, lineTotal: data.lineTotal });
      } catch {
        /* offline: the local number is still correct arithmetic */
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [drink.id, selected, quantity, quoteKey]);

  const choose = useCallback((m: Modifier) => {
    setSelected((prev) => {
      const rest = prev.filter((p) => p.kind !== m.kind);
      return [
        ...rest,
        {
          kind: m.kind,
          slug: m.slug,
          label: m.label,
          priceDelta: m.priceDelta,
          caffeineDelta: m.caffeineDelta,
        },
      ].sort(
        (a, b) => MODIFIER_ORDER.indexOf(a.kind) - MODIFIER_ORDER.indexOf(b.kind),
      );
    });
  }, []);

  const groups = MODIFIER_ORDER.filter((k) => drink.allowedModifiers.includes(k));
  // Only a quote for THIS exact configuration counts. Anything else and the
  // instantly-computed local price stands until the server catches up.
  const confirmed = serverQuote?.key === quoteKey ? serverQuote.lineTotal : null;
  const shown = confirmed ?? local.lineTotal;
  const disagrees = confirmed !== null && confirmed !== local.lineTotal;

  return (
    <div className="detail__builder">
      {groups.map((kind) => {
        const options = modifiers
          .filter((m) => m.kind === kind)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const active = selected.find((s) => s.kind === kind);
        return (
          <fieldset key={kind} className="builder-group">
            <legend className="field__label">{MODIFIER_LABELS[kind]}</legend>
            <div className="builder-options" role="radiogroup" aria-label={MODIFIER_LABELS[kind]}>
              {options.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active?.slug === m.slug}
                  className="chip"
                  data-active={active?.slug === m.slug || undefined}
                  onClick={() => choose(m)}
                  title={m.note}
                >
                  {m.label}
                  {m.priceDelta !== 0 ? (
                    <span className="mono" style={{ opacity: 0.7 }}>
                      {m.priceDelta > 0 ? '+' : '−'}
                      {formatMoney(Math.abs(m.priceDelta))}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {active?.slug && options.find((o) => o.slug === active.slug)?.note ? (
              <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                {options.find((o) => o.slug === active.slug)?.note}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      <div className="builder-summary">
        <div className="row-between">
          <div className="stack-sm">
            <span className="field__label">This cup</span>
            <span className="builder-summary__price">
              <NumberRoll value={shown} format={(n) => formatMoney(Math.round(n))} />
            </span>
          </div>
          {/* The Halo fills as the builder is engaged with. */}
          <Halo
            size={64}
            stroke={2}
            progress={preview.completeness}
            animateOnMount={false}
            label={`Builder ${Math.round(preview.completeness * 100)}% configured`}
          />
        </div>

        <div className="builder-meta">
          <span>
            <strong className="mono" style={{ color: 'var(--mist-100)' }}>
              <NumberRoll
                value={preview.caffeineMg * quantity}
                format={(n) => `${Math.round(n)}mg`}
              />
            </strong>{' '}
            caffeine
          </span>
          <span>
            {preview.volumeMl}ml · {preview.dairyFree ? 'dairy-free' : 'contains dairy'}
          </span>
          <span className="row" style={{ gap: 'var(--space-2)' }}>
            <IntensityMeter value={preview.intensity} />
            intensity
          </span>
        </div>

        <div className="note-chips">
          {preview.notes.map((n) => (
            <span key={n} className="chip chip--static">
              {n}
            </span>
          ))}
        </div>

        <div className="row-between">
          <Stepper value={quantity} onChange={setQuantity} label={drink.name} />
          <Button
            variant="primary"
            size="lg"
            disabled={!drink.isAvailable}
            loading={checking && confirmed === null && serverQuote === null}
            onClick={() => {
              add(drink, selected, quantity);
              toast(`${drink.name} added to the cart`, 'success');
              open();
            }}
          >
            {drink.isAvailable ? 'Add to cart' : 'Sold out'}
          </Button>
        </div>

        <p className="muted" style={{ fontSize: 11 }}>
          {disagrees
            ? 'The bar re-priced this — the number above is the server’s, and the server wins.'
            : confirmed !== null
              ? 'Confirmed by the server. Nothing is added later.'
              : 'Computed here for speed; the server confirms it in a moment.'}
        </p>
      </div>
    </div>
  );
}
