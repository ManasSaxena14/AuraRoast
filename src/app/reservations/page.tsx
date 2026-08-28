import type { Metadata } from 'next';
import { listStores } from '@/repositories';
import { Reveal } from '@/components/motion/Reveal';
import { Reserve } from '@/components/reservations/Reserve';

export const metadata: Metadata = {
  title: 'Reservations',
  description: 'Thirty-minute tables, Saturday cuppings, Wednesday brew classes.',
};

export default async function ReservationsPage() {
  const stores = await listStores();
  return (
    <div className="shell">
      <header className="page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Hold a table</p>
        </Reveal>
        <h1>Thirty minutes, or a whole Saturday morning.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Tables run in thirty-minute slots with a hard cap per slot, checked in a single
            statement — so when it says full, it is full, and when two people tap the last seat at
            once, exactly one of them gets it. Cuppings are Saturdays in Jayanagar; brew classes are
            Wednesdays in Koramangala.
          </p>
        </Reveal>
      </header>
      <Reserve stores={stores} />
      <div style={{ height: 'var(--space-10)' }} />
    </div>
  );
}
