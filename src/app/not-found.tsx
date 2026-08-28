import Link from 'next/link';
import { Halo } from '@/components/motion/Halo';

export default function NotFound() {
  return (
    <div className="login">
      <div style={{ justifySelf: 'center' }}>
        <Halo size={110} stroke={2} progress={0.42} />
      </div>
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>Nothing here.</h1>
      <p className="lede" style={{ marginInline: 'auto', maxWidth: '38ch' }}>
        That page does not exist — or it did and we took it off the board. The menu is the safest
        place to land.
      </p>
      <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
        <Link href="/menu" className="btn btn--primary">
          Open the menu
        </Link>
        <Link href="/" className="btn btn--outline">
          Back to the start
        </Link>
      </div>
    </div>
  );
}
