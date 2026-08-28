/**
 * Money is integer minor units (paise) everywhere. There is no float in the
 * schema and there is no float here. Blueprint §4.2.
 */
export type Paise = number;

export function paise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function rupees(p: Paise): number {
  return p / 100;
}

/** Percentage of a paise amount, rounded half-up, still integer. */
export function pct(amount: Paise, percent: number): Paise {
  return Math.round((amount * percent) / 100);
}

export function formatMoney(p: Paise, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: p % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(p / 100);
}

/** Compact form for tight UI (₹240 rather than ₹240.00). */
export function formatMoneyShort(p: Paise): string {
  return `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function sum(values: readonly Paise[]): Paise {
  return values.reduce((a, b) => a + b, 0);
}
