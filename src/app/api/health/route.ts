import { backendName, listDrinks } from '@/repositories';
import { features } from '@/config/env';
import { ok, fail } from '@/lib/http';
import { checkGroq } from '@/services/chat';

export const runtime = 'nodejs'; // every handler touching the data layer (§16.2)

/**
 * `GET /api/health` — cheap: backend, catalogue read latency, feature flags.
 * `GET /api/health?check=groq` — also calls Groq with the configured key to
 * confirm the AI Barista is live (the key itself is never returned).
 */
export async function GET(req: Request) {
  try {
    if (new URL(req.url).searchParams.get('check') === 'groq') {
      const groq = await checkGroq();
      return ok({ groq }, { status: groq.ok || !groq.configured ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
    }
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
