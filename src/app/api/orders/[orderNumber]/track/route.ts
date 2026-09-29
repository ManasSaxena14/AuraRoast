import { trackOrder } from '@/services/order';
import { fail, ok } from '@/lib/http';
import { sliceRoute } from '@/lib/geo';

export const runtime = 'nodejs';

/**
 * The tracking payload, polled roughly every 2.5s. Pure derivation from stored
 * data (§7.4) — zero external calls, ever. OSRM was called once, at
 * confirmation, and the geometry persisted.
 *
 * The order number is the capability: it is random (`AT-7K3M9Q`, ~30 bits),
 * so the link a guest is given is the thing that opens this, the way a parcel
 * tracking link works. What it returns is what the map draws — no name, no
 * email, no phone.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    const { order, state, store } = await trackOrder(orderNumber);
    return ok(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        state,
        travelled: sliceRoute(order.routeGeometry, state.travelledFraction),
        route: order.routeGeometry?.coordinates ?? [],
        routeSource: order.routeSource,
        store: store ? { name: store.name, lat: store.lat, lng: store.lng } : null,
        destination:
          order.fulfillment === 'delivery' && order.deliveryLat != null && order.deliveryLng != null
            ? { lat: order.deliveryLat, lng: order.deliveryLng }
            : null,
        plan: order.deliveryPlan
          ? { totalDurationMs: order.deliveryPlan.totalDurationMs, distanceKm: order.deliveryPlan.distanceKm }
          : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return fail(err);
  }
}
