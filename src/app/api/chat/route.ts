import { z } from 'zod';
import { askBarista } from '@/services/chat';
import { DomainError } from '@/domain/errors';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';

/**
 * The `as { message: string }` cast was erased at runtime, so a `null` body or
 * unparseable JSON became a TypeError and then an opaque 500 — while still
 * burning a token from the bucket. Parsed for real, and `message` is bounded
 * before it reaches the Groq prompt.
 */
const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.string().max(4000),
      }),
    )
    .max(40)
    .default([]),
});

/** Rate limited via the Postgres token bucket (§6.6). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'chat', 20, 60_000);
  if (limited) return limited;
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new DomainError('Malformed JSON body.', 'invalid_json', 400);
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError('That message could not be read.', 'invalid_body', 400, parsed.error.issues);
    }
    return ok(await askBarista(parsed.data.history, parsed.data.message));
  } catch (err) {
    return fail(err);
  }
}
