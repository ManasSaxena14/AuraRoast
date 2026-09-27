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
        lineId: z.string().default(''),
        drinkId: z.string().min(1).max(500),
        slug: z.string().max(500).default(''),
        name: z.string().max(500).default(''),
        imageUrl: z.string().default(''),
        quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
        modifiers: z
          .array(
            z.object({
              kind: z.string().max(100),
              slug: z.string().max(200),
              label: z.string().max(500).default(''),
              priceDelta: z.number().default(0),
              caffeineDelta: z.number().default(0),
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .max(100)
    .default([]),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  tip: z.coerce.number().min(0).max(10_000_000).nullish(),
  promoCode: z.string().max(100).nullish(),
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
    return ok(await previewCart({
      lines: parsed.data.lines as unknown as import('@/domain/types').CartLine[],
      fulfillment: parsed.data.fulfillment,
      tip: parsed.data.tip ?? 0,
      promoCode: parsed.data.promoCode,
    }));
  } catch (err) {
    return fail(err);
  }
}
