import { getOriginPage } from '@/services/catalog';
import { cached, fail } from '@/lib/http';
import { NotFoundError } from '@/domain/errors';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const data = await getOriginPage(slug);
    if (!data) throw new NotFoundError('Origin');
    return cached(data, 600);
  } catch (err) {
    return fail(err);
  }
}
