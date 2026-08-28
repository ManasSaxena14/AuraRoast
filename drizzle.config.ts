import type { Config } from 'drizzle-kit';

/**
 * Migrations run against the DIRECT (unpooled) endpoint; the app runs against
 * the pooled one (Blueprint §4.4, §22.3).
 */
export default {
  schema: './src/repositories/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config;
