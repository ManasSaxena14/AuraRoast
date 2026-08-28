import type { Metadata } from 'next';
import { listDrinks, listOrigins } from '@/repositories';
import { OriginsExperience } from '@/components/origins/OriginsExperience';

export const metadata: Metadata = {
  title: 'Origins',
  description: 'Five named farms in southern India, and the people who run them.',
};

export default async function OriginsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [{ focus }, origins, drinks] = await Promise.all([
    searchParams,
    listOrigins(),
    listDrinks(),
  ]);
  return <OriginsExperience origins={origins} drinks={drinks} initialFocus={focus} />;
}
