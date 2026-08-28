import { backendName, listDrinks } from '@/repositories';
import { features } from '@/config/env';
import { ok, fail } from '@/lib/http';

export const runtime = 'nodejs'; // every handler touching the data layer (§16.2)

export async function GET() {
  try {
    const started = Date.now();
    const drinks = await listDrinks();
    return ok({
      status: 'ok',
      backend: backendName(),
      readLatencyMs: Date.now() - started,
      catalogueSize: drinks.length,
      features,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return fail(err);
  }
}
