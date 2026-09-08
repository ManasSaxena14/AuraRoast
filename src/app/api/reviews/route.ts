import { z } from 'zod';
import { insertReview, listReviews, ratingSummary } from '@/repositories';
import { uuid } from '@/lib/ids';
import { DomainError } from '@/domain/errors';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';

/* The `as {...}` cast was compile-time only: a body of `null` or a string made
   the field reads below throw a TypeError and surface as a 500. */
const reviewSchema = z.object({
  drinkId: z.string().min(1).max(64),
  author: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).default(''),
});
export async function GET(req: Request) {
  try {
    const drinkId = new URL(req.url).searchParams.get('drinkId') ?? '';
    return ok({ reviews: await listReviews(drinkId), summary: await ratingSummary(drinkId) });
  } catch (err) {
    return fail(err);
  }
}
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'reviews', 6, 60_000);
  if (limited) return limited;
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new DomainError('Malformed JSON body.', 'invalid_json', 400);
    }
    const parsed = reviewSchema.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError('That review could not be read.', 'invalid_review', 400, parsed.error.issues);
    }
    const body = parsed.data;
    if (!body.author.trim()) {
      throw new DomainError('A name and a drink are required.', 'invalid_review', 400);
    }
    const review = await insertReview({
      id: uuid(),
      drinkId: body.drinkId,
      userId: null,
      author: body.author.trim().slice(0, 40),
      rating: body.rating,
      body: body.body.trim().slice(0, 600),
      createdAt: new Date().toISOString(),
    });
    return ok({ review }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
