import { z } from 'zod';
import { quote } from '@/services/catalog';
import { fail, ok } from '@/lib/http';
import { DomainError, NotFoundError } from '@/domain/errors';
import { MAX_LINE_QUANTITY } from '@/domain/pricing';

export const runtime = 'nodejs';

/**
 * The `as {...}` cast was compile-time only, so `modifiers: "nope"` or
 * `[null]` reached `priceLine` as a TypeError and came back as a 500. Only
 * `kind`/`slug` are trusted here — `priceCart` re-reads every number from the
 * stored catalogue (§9.1) — so the rest is accepted loosely and discarded.
 */
const bodySchema = z.object({
  drinkId: z.string().min(1),
  modifiers: z
    .array(
      z.object({
        kind: z.enum(['size', 'milk', 'syrup', 'shot', 'temperature']),
        slug: z.string().min(1).max(64),
        label: z.string().max(160).default(''),
        priceDelta: z.number().default(0),
        caffeineDelta: z.number().default(0),
      }),
    )
    .max(20)
    .default([]),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY).default(1),
});

/**
 * The authoritative price for a Brew Builder configuration (§9.1).
 * The client runs the same pure function for feel; this is the truth.
 */
export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new DomainError('Malformed JSON body.', 'invalid_json', 400);
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError('That quote request could not be read.', 'invalid_body', 400, parsed.error.issues);
    }
    const { drinkId, modifiers, quantity } = parsed.data;
    const result = await quote(drinkId, modifiers, quantity);
    if (!result) throw new NotFoundError('Drink');
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
