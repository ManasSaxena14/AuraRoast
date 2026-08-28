import type { Metadata } from 'next';
import { listStores } from '@/repositories';
import { Reveal } from '@/components/motion/Reveal';
import { StoreLocator } from '@/components/stores/StoreLocator';

export const metadata: Metadata = {
  title: 'Stores',
  description:
    'Twelve bars across Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune and Chennai. Live hours, order ahead.',
};

export default async function StoresPage() {
  const stores = await listStores();
  return (
    <div className="shell">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Come in</p>
        </Reveal>
        <h1>Twelve rooms. One roastery.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Every bar is served from the same drum in Koramangala, roasted Tuesday and Friday and on
            a plane or a truck the same week. Nothing sits in a warehouse. The rooms are different
            on purpose — a locator where every entry reads the same is a locator nobody reads twice.
          </p>
        </Reveal>
      </header>
      <StoreLocator stores={stores} />
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
