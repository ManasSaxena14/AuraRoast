/**
 * The Postgres client — one shape, two drivers.
 *
 *   · a Neon URL (`*.neon.tech`) goes over Neon's HTTP driver: no socket, no
 *     pool, nothing to exhaust from a serverless function
 *   · any other Postgres (a local one in development, a VPS in production)
 *     goes over node-postgres with a small pool
 *
 * With no `DATABASE_URL` (or `AURA_EPHEMERAL` set) there is no client at all
 * and the repositories use the in-process adapter instead.
 */
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Driver-agnostic handle: the query builder API is identical across drivers,
// only the result HKT differs, and nothing here depends on it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

const dbUrl = process.env.AURA_EPHEMERAL ? undefined : process.env.DATABASE_URL || undefined;

export const isPostgres = Boolean(dbUrl);

function isNeon(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.neon.tech');
  } catch {
    return false;
  }
}

export interface Client {
  db: Db;
  /** Runs every query in ONE transaction: all of them land, or none do. */
  atomic: (build: (db: Db) => unknown[]) => Promise<unknown[]>;
  /** Releases the pool — scripts call this so the process can exit. */
  close: () => Promise<void>;
}

// Kept on globalThis so dev-mode HMR does not open a new pool per edit.
const g = globalThis as unknown as { __auraDb?: Promise<Client> };

/** Also used by the seed script, so it talks to the database the same way. */
export async function connect(url: string): Promise<Client> {
  if (isNeon(url)) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const db = drizzle(neon(url), { schema });
    return {
      db: db as unknown as Db,
      // The HTTP driver cannot hold an interactive transaction open across
      // round trips; `batch` sends the statements together and the server
      // runs them in a single transaction.
      atomic: async (build) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await db.batch(build(db as unknown as Db) as any)) as unknown[],
      close: async () => {},
    };
  }

  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
  const db = drizzle(pool, { schema });
  return {
    db: db as unknown as Db,
    atomic: (build) =>
      db.transaction(async (tx) => {
        const out: unknown[] = [];
        for (const query of build(tx as unknown as Db)) out.push(await query);
        return out;
      }),
    close: () => pool.end(),
  };
}

function client(): Promise<Client> | null {
  if (!dbUrl) return null;
  if (!g.__auraDb) {
    g.__auraDb = connect(dbUrl).catch((err) => {
      // A failed import or a bad URL must not be cached forever.
      g.__auraDb = undefined;
      throw err;
    });
  }
  return g.__auraDb;
}

export async function getDb(): Promise<Db | null> {
  const c = client();
  return c ? (await c).db : null;
}

export async function atomic(build: (db: Db) => unknown[]): Promise<unknown[]> {
  const c = client();
  if (!c) throw new Error('atomic() called without a database');
  return (await c).atomic(build);
}

/** Postgres error code, whichever driver raised it and however drizzle wrapped it. */
export function pgErrorCode(err: unknown): string | undefined {
  let e = err as { code?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; e && depth < 4; depth++) {
    if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
    e = e.cause as typeof e;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = '23505';
