import type { Store } from '@/domain/types';

/** Every room is in India, so open/closed reads the IST wall clock, not the visitor's. */
const IST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function openState(store: Store, now: Date): { open: boolean; label: string } {
  const parts = IST.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hours = store.hours[part('weekday').toLowerCase()];
  if (!hours) return { open: false, label: 'Closed today' };
  const [from, to] = hours;
  const mins = Number(part('hour')) * 60 + Number(part('minute'));
  const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const open = mins >= toMins(from) && mins < toMins(to);
  return { open, label: open ? `Open until ${to}` : `Opens ${from}` };
}
