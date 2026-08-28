/**
 * UPI deep-link + QR payload (Blueprint §8.3).
 * A pure function. No gateway, no API, no network call — and no card data
 * exists anywhere in this system by design (§8.1).
 */
export interface UpiPayload {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  orderNumber: string;
}

export function buildUpiUri(o: UpiPayload): string {
  const params = new URLSearchParams({
    pa: o.upiId, // payee address
    pn: o.payeeName, // payee name
    am: (o.amountPaise / 100).toFixed(2), // amount, rupees
    cu: 'INR',
    tn: `Aura Toast ${o.orderNumber}`, // transaction note
    tr: o.orderNumber, // reference
  });
  return `upi://pay?${params.toString()}`;
}

/** UTR is 12 digits. Optional — the guest may not have it to hand. */
export function isPlausibleUtr(value: string): boolean {
  return /^\d{12}$/.test(value.trim());
}
