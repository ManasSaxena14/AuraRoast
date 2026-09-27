import { z } from 'zod';
import { previewCart } from '@/services/catalog';
import { DomainError } from '@/domain/errors';
import { MAX_LINE_QUANTITY } from '@/domain/pricing';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';

/**
 * The body used to go straight into `priceCart`, so `{}` or invalid JSON came
 * back as an opaque 500 with an `unhandled_route_error` stack behind it. Only
 * `drinkId`/`quantity`/modifier `kind`+`slug` are load-bearing — every price
 * is re-read from the stored catalogue (§9.1) — so the rest is loose.
 */
const bodySchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().max(64).default(''),
        drinkId: z.string().min(1),
        slug: z.string().max(120).default(''),
        name: z.string().max(200).default(''),
        imageUrl: z.string().max(2000).default(''),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
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
      }),
    )
    .max(50),
  fulfillment: z.enum(['delivery', 'pickup']),
  tip: z.number().int().min(0).max(1_000_000).optional(),
  promoCode: z.string().max(32).nullish(),
});

/** Authoritative cart totals. The only number checkout is allowed to show. */
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
      throw new DomainError('That cart could not be read.', 'invalid_body', 400, parsed.error.issues);
    }
    return ok(await previewCart(parsed.data));
  } catch (err) {
    return fail(err);
  }
}
