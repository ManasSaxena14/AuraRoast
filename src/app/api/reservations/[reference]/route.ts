import { cancel, lookup } from '@/services/reservation';
import { fail, ok } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params;
    return ok({ reservation: await lookup(reference) });
  } catch (err) {
    return fail(err);
  }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params;
    return ok({ reservation: await cancel(reference) });
  } catch (err) {
    return fail(err);
  }
}
