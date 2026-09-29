import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { insertReview, listDrinks, listReviews, ratingSummary } from '@/repositories';
import { uuid } from '@/lib/ids';
import { DomainError, NotFoundError } from '@/domain/errors';
import { fail, ok, rateLimit, readJson } from '@/lib/http';
import { getViewer } from '@/lib/session';

export const runtime = 'nodejs';

const reviewSchema = z.object({
  drinkId: z.string().min(1).max(64),
  author: z.string().max(120).default(''),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).default(''),
});

export async function GET(req: Request) {
  try {
    const drinkId = new URL(req.url).searchParams.get('drinkId') ?? '';
    const [reviews, summary] = await Promise.all([listReviews(drinkId), ratingSummary(drinkId)]);
    return ok({ reviews, summary });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, 'reviews', 6, 60_000);
  if (limited) return limited;
  try {
    const parsed = reviewSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new DomainError('That review could not be read.', 'invalid_review', 400, parsed.error.issues);
    }
    const body = parsed.data;
    const [viewer, drinks] = await Promise.all([getViewer(), listDrinks()]);
    const drink = drinks.find((d) => d.id === body.drinkId);
    if (!drink) throw new NotFoundError('Drink');

    // Signed in, the account name stands in for an empty field — and the
    // account gets one review per drink, which writing again edits.
    const author = (body.author.trim() || (viewer && !viewer.demo ? viewer.user.name : '')).slice(0, 40);
    if (!author) throw new DomainError('A name is required.', 'invalid_review', 400);

    const review = await insertReview({
      id: uuid(),
      drinkId: drink.id,
      userId: viewer && !viewer.demo ? viewer.user.id : null,
      author,
      rating: body.rating,
      body: body.body.trim().slice(0, 600),
      createdAt: new Date().toISOString(),
    });

    // Drink pages are prerendered; this one re-renders with the review on it.
    revalidatePath(`/menu/${drink.slug}`);
    return ok({ review }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
