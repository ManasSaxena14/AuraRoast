import { getGuide } from '@/repositories';
import { cached, fail } from '@/lib/http';
import { NotFoundError } from '@/domain/errors';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const guide = await getGuide(slug);
    if (!guide) throw new NotFoundError('Guide');
    return cached({ guide }, 600);
  } catch (err) {
    return fail(err);
  }
}
