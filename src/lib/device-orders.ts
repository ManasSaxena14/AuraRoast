/**
 * Orders placed from THIS browser, remembered locally.
 *
 * Two jobs. A guest who never signs in still has somewhere to find their
 * orders (/account lists these). And the contact detail typed at checkout is
 * kept here — on the guest's own device — to prove ownership when they cancel
 * or add a UPI reference, instead of the server printing their email into a
 * tracking page anyone with the link can open.
 */
export interface DeviceOrder {
  orderNumber: string;
  /** The email (or phone) given at checkout — the X-Aura-Contact proof. */
  contact: string;
  placedAt: string;
  total: number;
}

const KEY = 'aura.orders';
const MAX = 25;

export function deviceOrders(): DeviceOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is DeviceOrder =>
        !!o && typeof o.orderNumber === 'string' && typeof o.contact === 'string',
    );
  } catch {
    return [];
  }
}

export function rememberOrder(order: DeviceOrder): void {
  try {
    const rest = deviceOrders().filter((o) => o.orderNumber !== order.orderNumber);
    localStorage.setItem(KEY, JSON.stringify([order, ...rest].slice(0, MAX)));
  } catch {
    /* private mode / quota — the tracking link still works on its own */
  }
}

export function contactFor(orderNumber: string): string | null {
  return deviceOrders().find((o) => o.orderNumber === orderNumber)?.contact ?? null;
}
