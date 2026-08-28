import { paymentSettings } from '@/services/payment';
import { cached, fail } from '@/lib/http';
export const runtime = 'nodejs';
/** Public by design — a UPI ID exists to be shared to receive money (§8.2). */
export async function GET() {
  try {
    return cached(paymentSettings(), 3600);
  } catch (err) {
    return fail(err);
  }
}
