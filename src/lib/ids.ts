import { randomUUID } from 'node:crypto';

export function uuid(): string {
  return randomUUID();
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — read aloud safely

export function shortCode(length = 6): string {
  let out = '';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Stable JSON: object keys sorted at EVERY depth, arrays left in order.
 *
 * `JSON.stringify(value, keysArray)` is not a substitute — the array form is a
 * property allowlist applied at every level, so nested objects whose keys are
 * not in the list serialize as `{}`. That silently erases the part of the
 * payload the idempotency check exists to compare.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Deterministic hash used for idempotency request-body comparison (§9.3). */
export async function hashPayload(payload: unknown): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stableStringify(payload)),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function reservationReference(): string {
  return `AT-R${shortCode(5)}`;
}

/**
 * `AT-7K3M9Q` — random, not sequential.
 *
 * A counter held in process memory restarts at the same value on every cold
 * serverless instance, so two instances handed out the same number and the
 * second order overwrote the first. Sequential numbers were also the only
 * thing standing between a stranger and every tracking page. 32^6 ≈ 1.07
 * billion codes: unguessable in practice, and a collision is caught by the
 * unique index and retried.
 */
export function orderNumber(): string {
  return `AT-${shortCode(6)}`;
}

/** What a guest types: `7k3m9q`, `at7k3m9q`, `AT-7K3M9Q`, or a legacy `1042`. */
export function normaliseOrderNumber(raw: string): string {
  const value = raw.trim().toUpperCase().replace(/[\s–—]+/g, '');
  if (/^\d{1,6}$/.test(value)) return `AT-${value.padStart(6, '0')}`;
  const bare = value.replace(/^AT-?/, '');
  return /^[A-Z0-9]{6}$/.test(bare) ? `AT-${bare}` : value;
}

/**
 * Matches both the random codes and the legacy six-digit numbers inside free
 * text. The dash is required here — without it "attitude" reads as AT-TITUDE.
 */
export const ORDER_NUMBER_PATTERN = /\bAT-[A-Z0-9]{6}\b/i;
