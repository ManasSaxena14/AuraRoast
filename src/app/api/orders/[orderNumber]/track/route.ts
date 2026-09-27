import { trackOrder } from '@/services/order';
import { fail, ok, provesContact } from '@/lib/http';
import { sliceRoute } from '@/lib/geo';
import { NotFoundError } from '@/domain/errors';
import { getOrderByNumber } from '@/repositories';

export const runtime = 'nodejs';

/**
 * The tracking payload, polled roughly every 2.5s. Pure derivation from stored
 * data (§7.4) — zero external calls, ever. OSRM was called once, at
 * confirmation, and the geometry persisted.
 *
 * Guarded like the other order routes: the destination coordinates below are
 * the guest's home address, and order numbers are sequential.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;

    const existing = await getOrderByNumber(orderNumber);
    if (!existing) {
      throw new NotFoundError('Order');
    }

    const { order, state, store } = await trackOrder(orderNumber);
    return ok(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        state,
        travelled: sliceRoute(order.routeGeometry, state.travelledFraction),
        route: order.routeGeometry?.coordinates ?? [],
        routeSource: order.routeSource,
        store: store ? { name: store.name, lat: store.lat, lng: store.lng } : null,
        destination:
          order.deliveryLat != null && order.deliveryLng != null
            ? { lat: order.deliveryLat, lng: order.deliveryLng }
            : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return fail(err);
  }
}
