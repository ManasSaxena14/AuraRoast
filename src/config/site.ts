export const SITE = {
  name: 'AURA TOAST',
  tagline: 'Atmospheric Craft, Pure Origin',
  description:
    'Single-origin coffee from five named farms in southern India. Order, track, and read where it grew.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;

export const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/origins', label: 'Origins' },
  { href: '/guides', label: 'Guides' },
  { href: '/reservations', label: 'Reserve' },
  { href: '/stores', label: 'Stores' },
] as const;

export const FOOTER_NAV = [
  {
    title: 'Order',
    links: [
      { href: '/menu', label: 'Full menu' },
      { href: '/menu?category=beans', label: 'Beans' },
      { href: '/account?tab=subscriptions', label: 'Subscriptions' },
      { href: '/checkout', label: 'Checkout' },
    ],
  },
  {
    title: 'Read',
    links: [
      { href: '/origins', label: 'The five origins' },
      { href: '/guides', label: 'Brew guides' },
      { href: '/stores', label: 'Find a bar' },
      { href: '/reservations', label: 'Cuppings & classes' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/account', label: 'Orders' },
      { href: '/account?tab=loyalty', label: 'Halo tiers' },
      { href: '/login', label: 'Sign in' },
      { href: '/admin', label: 'Admin' },
      { href: '/credits', label: 'Photo credits' },
    ],
  },
] as const;
