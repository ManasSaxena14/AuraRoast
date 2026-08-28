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
