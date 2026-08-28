import { BRAND, FAQ, HERO, HOW_IT_WORKS, MANIFESTO, NUMBERS } from '@/data/content';
import { cached, fail } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return cached({ brand: BRAND, hero: HERO, howItWorks: HOW_IT_WORKS, manifesto: MANIFESTO, numbers: NUMBERS, faq: FAQ }, 600);
  } catch (err) {
    return fail(err);
  }
}
