import type { Config } from 'drizzle-kit';

// drizzle-kit's bundled dotenv only reads `.env`, but the credentials live in
// `.env.local` (that is what `.env.local.example` tells you to create), so the
// db:* scripts would otherwise never see the URL they are asking for.
try {
  process.loadEnvFile('.env.local');
} catch {
  // No `.env.local` — an inline `DATABASE_URL_UNPOOLED=... npm run db:migrate` still works.
}

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
