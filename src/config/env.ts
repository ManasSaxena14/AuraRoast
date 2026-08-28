import { z } from 'zod';

/**
 * Boot-time validated environment (Blueprint §19.1).
 *
 * Everything here is OPTIONAL on purpose: the product runs end to end with an
 * empty `.env.local`, using the in-process data adapter, a placeholder UPI ID
 * and the local Barista. Adding a real value upgrades that surface in place —
 * nothing in the build blocks on a credential.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),

  // Postgres — present → Neon/Drizzle path, absent → in-process adapter
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),

  // Auth.js v5 · Google is the only sign-in (§5.1)
  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  // AI Barista (§6.5) — free tier
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  // Merchant details are configuration, not secrets (§8.2)
  UPI_ID: z.string().default('auratoast@upi'),
  UPI_PAYEE_NAME: z.string().default('Aura Toast Coffee'),

  CRON_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail loudly at boot rather than mysteriously at request time.
  console.error('Invalid environment:', z.treeifyError(parsed.error));
  throw new Error('Environment validation failed');
}

export const env = parsed.data;

export const features = {
  postgres: Boolean(env.DATABASE_URL),
  googleAuth: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  groq: Boolean(env.GROQ_API_KEY),
} as const;
