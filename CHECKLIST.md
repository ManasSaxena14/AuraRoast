# Definition of done

Ticked against what is actually in the repo, not against intent. Anything false says so.

## Data
- [x] Every money column is `integer` minor units; no float anywhere in the schema
- [x] Indexes exist with a named query each (`src/repositories/schema.ts`)
- [x] `never_overbooked` and `total_is_consistent` CHECK constraints are live
- [x] Split-driver strategy documented; migrations target the direct endpoint, app the pooled one
- [x] Seed is idempotent — `onConflictDoNothing` on every natural key
- [x] The in-process adapter honours the same invariants as the Postgres path

## Correctness
- [x] No read-then-write capacity check exists anywhere
- [x] `POST /api/orders` rejects a request with no `Idempotency-Key` (400)
- [x] Same key + different body returns 422, not a silent replay
- [x] Loyalty tier appears in no table — only in `deriveLoyalty()` on read
- [x] Every `orders.status` write goes through `assertTransition`
- [x] Both concurrency tests pass, repeatedly
- [x] The idempotency request hash sees nested values (regression-tested)

## Free APIs
- [x] No Google Maps, Mapbox, or key-gated map service in `package.json`
- [x] Leaflet is imported in exactly one file (`src/components/map/MapCanvas.tsx`)
- [x] Map attribution is visible on every map instance
- [x] OSRM is called once per order and the geometry is persisted
- [x] Nominatim is server-side only, with a real User-Agent, and cached
- [x] Rate limiting is a Postgres token bucket — no Redis dependency

## Motion
- [x] `grep -r "cubic-bezier(" src/ | grep -v tokens.css` returns nothing (enforced in CI script)
- [x] Every scroll reveal goes through `<Reveal>`
- [x] Every GSAP animation is inside a `useGSAP({ scope })` context
- [x] Lenis is wired to `ScrollTrigger.update` **and** `gsap.ticker`
- [x] Lenis is off, not slowed, under reduced motion
- [x] `ScrollTrigger.refresh()` runs after `document.fonts.ready`
- [x] The `menu → detail` shared-element morph works
- [x] The `confirmation → tracking` Halo carry-over works
- [x] Only the tapped card is ever given a `view-transition-name`
- [x] No transition exceeds 480ms except the confirmation ceremony
- [x] Every route in the site map has its specified transition and scroll behaviour
- [x] The Halo appears exactly five times, each communicating state
- [x] The order-placing ceremony narrates real server work and waits on the real response
- [x] Tracking interpolates between polls rather than lurching every 2.5s
- [x] No CSS transition is retriggered faster than its own duration

## Performance & a11y
- [ ] **Initial route JS ≤ 170 KB gz — NOT met (~235 KB).** Reason and trade documented in the README
- [x] Hero media inside budget (4.1 MB desktop / 1.1 MB mobile)
- [x] Every image and map container has a reserved box before it loads
- [x] Reduced-motion branch exists for every scroll animation
- [x] Primary CTA is keyboard-reachable during the hero pin
- [x] Route changes are announced to screen readers and move focus
- [x] Skip link is the first focusable element on every page
- [ ] Lighthouse CI wiring — not set up in this build
- [ ] Verified on a real mid-tier Android — not available in this environment

## Security
- [x] `.env.local` is gitignored and has never been committed
- [x] `GROQ_API_KEY` is read only in server code; it appears in no client bundle
- [x] No card data exists anywhere in the schema
- [x] The admin verify route re-checks the admin flag server-side
- [x] Rate limiting is live on `/api/chat`, `/api/geocode`, `/api/orders`, `/api/reservations`, `/api/reviews`
