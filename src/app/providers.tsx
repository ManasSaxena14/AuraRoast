'use client';
import dynamic from 'next/dynamic';
import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '@/components/cart/CartProvider';
import { ToastProvider, useToastBridge } from '@/components/toast/ToastProvider';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { ViewTransitions } from '@/components/motion/ViewTransitions';
import { ScrollSkew } from '@/components/motion/ScrollSkew';
import type { Drink, Modifier } from '@/domain/types';

/* Neither of these renders anything until the guest asks for it, so neither
   belongs in the initial bundle (§16.2). */
const CartDrawer = dynamic(
  () => import('@/components/cart/CartDrawer').then((m) => m.CartDrawer),
  { ssr: false },
);
const Barista = dynamic(() => import('@/components/barista/Barista').then((m) => m.Barista), {
  ssr: false,
});

function ToastBridge() {
  useToastBridge();
  return null;
}

/**
 * The session is only fetched when sign-in is actually configured — otherwise
 * every page view would fire a request at an auth endpoint that can only
 * answer with an error. Refetching on every window focus is off too: nothing
 * on this site changes the session from another tab often enough to be worth
 * a request each time someone alt-tabs back.
 */
function MaybeSession({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}

export function AppProviders({
  drinks,
  modifiers,
  authEnabled,
  children,
}: {
  drinks: Drink[];
  modifiers: Modifier[];
  authEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <MaybeSession enabled={authEnabled}>
      <ToastProvider>
        <ToastBridge />
        <CartProvider catalogue={drinks} modifiers={modifiers}>
          <ViewTransitions>
            <SmoothScroll>{children}</SmoothScroll>
          </ViewTransitions>
          {/* One ticker and one trigger for every [data-skew] section on the page. */}
          <ScrollSkew />
          <CartDrawer />
          <Barista drinks={drinks} modifiers={modifiers} />
        </CartProvider>
      </ToastProvider>
    </MaybeSession>
  );
}
