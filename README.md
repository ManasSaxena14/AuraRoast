# AURA TOAST

**Atmospheric Craft · Pure Origin**

<p align="center">
  <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&auto=format&fit=crop&q=80" alt="AURA TOAST — coffee and pastry on a dark table" width="900" />
</p>

> Premium single-origin coffee from five named farms in southern India. Order, track delivery, reserve a table, and read where every bean was grown.

<p align="center">
  <a href="https://v0.dev" target="_blank" rel="noopener">Live preview ↗</a>
  &nbsp;·&nbsp;
  <a href="#demo">Demo walkthrough</a>
  &nbsp;·&nbsp;
  <a href="#architecture">Architecture</a>
  &nbsp;·&nbsp;
  <a href="#setup">Setup</a>
</p>

---

## What you get

### Brand experience
- Scroll-scrubbed 240-frame hero sequence (bean → roast → bloom → pour → cup)
- One-time brand gate animation on every new session
- Page-transition fades between every client-side navigation
- Scroll-driven steam, parallax copy, and scroll-progress bar
- Premium typography, spacing, micro-interactions, and hover states throughout
- Fully responsive — mobile, tablet, and desktop

### Ordering
- Real-time menu with category filtering and live stock counts
- Cart with add/remove, quantity controls, and overlay drawer
- Cash-on-delivery and UPI checkout flows with state-machine confirmation
- Order confirmation with animated receipt, live countdown, and auto-redirect to delivery tracking
- Full order-tracking page with status progression and estimated arrival

### Delivery & tracking
- OSRM-powered nearest-outlet selection at checkout
- Real-time order status: confirmed → preparing → out for delivery → delivered
- Progress bar, timestamp history, and driver notes

### Reservations
- 21-day rolling slot grid for all 6 cities / 12 locations
- Slot availability driven by capacity + existing bookings
- Reference-based booking confirmation

### Admin
- Payments queue: verify UPI transfers in one click
- Full order list with search, status filter, and date sorting
- Revenue stats (gross, today, average order value, top-selling item)
- Reservation viewer and full catalogue inspector

### Content
- Origins: five-farm storytelling with maps and tasting notes
- Pairings: curated food companions for each drink
- Locations: six-city, twelve-room directory
- About: brand story, roast philosophy, and kitchen

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | CSS custom properties + design tokens |
| Motion | GSAP + ScrollTrigger |
| State | React Context (cart) + server components |
| Database | Neon (PostgreSQL, serverless) |
| Maps | Leaflet |
| Payments | Cash-on-delivery + UPI (manual verify) |
| Hosting | Vercel-ready |

---

## Project structure

```
aura-toast/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Home (Hero + Menu)
│   │   ├── menu/page.tsx         # Full menu
│   │   ├── about/page.tsx        # Brand story
│   │   ├── pairings/page.tsx     # Coffee + food pairings
│   │   ├── locations/page.tsx    # City directory
│   │   ├── origins/page.tsx      # Five farms
│   │   ├── reserve/page.tsx      # Reservations
│   │   ├── track/page.tsx        # Delivery tracking
│   │   ├── order/page.tsx        # Checkout
│   │   ├── admin/page.tsx        # Back-of-house dashboard
│   │   └── account/page.tsx      # Guest account
│   │
│   ├── components/
│   │   ├── admin/                # Admin dashboard
│   │   ├── cart/                 # Cart provider + drawer
│   │   ├── checkout/             # Checkout + confirmation
│   │   ├── home/                 # Hero, menu card, origin cards
│   │   ├── layout/               # Header, footer
│   │   ├── motion/               # GSAP utilities
│   │   ├── reservations/         # Slot grid
│   │   ├── stores/               # Map + locator
│   │   ├── track/                # Tracker
│   │   └── ui/                   # Shared primitives
│   │
│   ├── domain/                   # Core domain layer
│   │   ├── types.ts              # TypeScript types
│   │   ├── state-machine.ts      # Order stage transitions
│   │   ├── money.ts              # Currency formatting
│   │   └── units.ts              # ML, grams, etc.
│   │
│   ├── data/
│   │   └── content.ts            # Static copy, hero text, etc.
│   │
│   ├── lib/                      # HTTP client, IDs
│   ├── repositories/             # Data-access layer
│   │   ├── index.ts              # Client (calls API routes)
│   │   ├── memory/               # In-memory fallback
│   │   └── schema.ts             # PostgreSQL DDL
│   │
│   ├── styles/                   # CSS modules
│   │   ├── tokens.css            # Design tokens
│   │   ├── base.css              # Reset + base
│   │   ├── components.css        # Buttons, cards, forms
│   │   ├── motion.css            # Animation classes
│   │   ├── transitions.css       # Page transitions
│   │   ├── layout.css            # Header, footer, shell
│   │   ├── pages.css             # Page-specific styles
│   │   └── map.css               # Leaflet overrides
│   │
│   └── config/
│       └── site.ts               # NAV, SITE, FOOTER_NAV
│
├── hero/                         # Scrub frames (240 .webp)
│   ├── desktop/                  # 144 frames @ 1280×720
│   └── mobile/                   # 72 frames @ 640×360
│
├── public/
│   └── images/                   # Menu images, origin cards
│
├── tests/
│   ├── unit/                     # Domain-level tests
│   └── concurrency/              # Race-condition tests
│
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## Key design decisions

### Why no CSS-in-JS or Tailwind utility classes?
Every visual property flows from one file: `src/styles/tokens.css`. Changing the brand colour, spacing scale, or typography scale is a single edit. No runtime CSS injection, no class-name collisions, no dead-code stripping risk.

### Why a state machine for orders?
Orders move through well-defined stages (`pending_payment → confirmed → preparing → out_for_delivery → delivered` or `cancelled`). A state machine prevents invalid transitions (e.g., delivering an unpaid order) and centralises copy for every stage.

### Why the OSRM lookup at verification time?
The delivery plan is written the moment a UPI transfer is confirmed — not at checkout. This keeps the stock reservation logic tight: seats are held for 10 minutes, then released.

### Why 240 frames?
The scrub is frame-by-frame animation rendered to a single `<canvas>` via `createImageBitmap` (off-thread decoding). No 240 `<img>` tags, no per-scroll React state. The engine paints straight to the backing store.

---

## Database schema

```sql
-- Core tables
CREATE TABLE drinks (...);
CREATE TABLE orders (...);
CREATE TABLE order_items (...);
CREATE TABLE reservations (...);
CREATE TABLE reservation_slots (...);
CREATE TABLE outlets (...);
CREATE TABLE guests (...);

-- Full DDL: src/repositories/schema.ts
```

See `src/repositories/schema.ts` for the complete PostgreSQL DDL, indexes, and RLS policies.

---

## Environment variables

```env
# Database (Neon)
DATABASE_URL="postgres://..."

# App
NEXT_PUBLIC_SITE_URL="https://aura-toast.vercel.app"

# Maps (optional — uses OpenStreetMap fallback)
NEXT_PUBLIC_MAPBOX_TOKEN="..."
```

---

## Demo walkthrough

1. **Open the home page** — watch the brand gate animate, then the hero scrub.
2. **Scroll** — steam rises, copy parallaxes, scroll-progress bar advances.
3. **Navigate** — Pairings, About, Locations, Origins, Reserve, Track, Order.
4. **Reserve a table** — pick a date, slot, and party size.
5. **Order coffee** — add items to cart, proceed to checkout, choose delivery method.
6. **Track your order** — watch status update in real time.

---

## License

MIT

---

<p align="center">
  Built with ☕ by the AURA TOAST team
</p>
