import type { Metadata } from 'next';
import { backendName, listDrinks, listReservations } from '@/repositories';
import { recentOrders } from '@/services/order';
import { AdminDash } from '@/components/admin/AdminDash';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [orders, reservations, drinks] = await Promise.all([
    recentOrders(),
    listReservations(),
    listDrinks(),
  ]);
  return (
    <AdminDash
      initialOrders={orders}
      reservations={reservations}
      drinks={drinks}
      backend={backendName()}
    />
  );
}
