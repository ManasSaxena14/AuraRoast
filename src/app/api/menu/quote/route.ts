import { quote } from '@/services/catalog';
import { fail, ok } from '@/lib/http';
import { NotFoundError } from '@/domain/errors';
import type { SelectedModifier } from '@/domain/types';

export const runtime = 'nodejs';

/**
 * The authoritative price for a Brew Builder configuration (§9.1).
 * The client runs the same pure function for feel; this is the truth.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      drinkId: string;
      modifiers: SelectedModifier[];
      quantity?: number;
    };
    const result = await quote(body.drinkId, body.modifiers ?? [], body.quantity ?? 1);
    if (!result) throw new NotFoundError('Drink');
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
