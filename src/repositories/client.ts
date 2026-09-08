/**
 * Neon HTTP Drizzle client.
 *
 * When `DATABASE_URL` is set (and not in ephemeral test mode), queries connect
 * directly to Neon PostgreSQL over HTTP (serverless-friendly, zero connection pool exhaustion).
 * Otherwise, falls back gracefully to the in-process adapter.
 */
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const dbUrl = process.env.AURA_EPHEMERAL ? undefined : (process.env.DATABASE_URL || undefined);

export const isPostgres = Boolean(dbUrl);

let _db: NeonHttpDatabase<typeof schema> | null = null;

export async function getDb(): Promise<NeonHttpDatabase<typeof schema> | null> {
  if (!_db && dbUrl) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const sql = neon(dbUrl);
    _db = drizzle(sql, { schema });
  }
  return _db;
}
