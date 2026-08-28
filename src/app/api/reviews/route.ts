import { insertReview, listReviews, ratingSummary } from '@/repositories';
import { uuid } from '@/lib/ids';
import { DomainError } from '@/domain/errors';
import { fail, ok, rateLimit } from '@/lib/http';
export const runtime = 'nodejs';
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
    const body = (await req.json()) as { drinkId: string; author: string; rating: number; body: string };
    if (!body.drinkId || !body.author?.trim()) {
      throw new DomainError('A name and a drink are required.', 'invalid_review', 400);
    }
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      throw new DomainError('Rating must be 1–5.', 'invalid_rating', 400);
    }
    const review = await insertReview({
      id: uuid(),
      drinkId: body.drinkId,
      userId: null,
      author: body.author.trim().slice(0, 40),
      rating: body.rating,
      body: (body.body ?? '').trim().slice(0, 600),
      createdAt: new Date().toISOString(),
    });
    return ok({ review }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
