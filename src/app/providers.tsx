'use client';
import dynamic from 'next/dynamic';
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

export function AppProviders({
  drinks,
  modifiers,
  children,
}: {
  drinks: Drink[];
  modifiers: Modifier[];
  children: React.ReactNode;
}) {
  return (
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
  );
}
