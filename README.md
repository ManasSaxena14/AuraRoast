<div align="center">

# AURA TOAST
### *Atmospheric Craft, Pure Origin*

**Next.js 16 · React 19 · PostgreSQL / Drizzle · GSAP + Lenis · Leaflet · Groq**

*A single-origin coffee bar built at the seam between what you can measure and what you can feel.*

</div>

---

## The pitch

Coffee is two things at once: a material fact and a felt atmosphere. A bean has an origin, an
altitude, a farmer, a roast curve — all measurable, all true. And then there is what happens in the
room when it lands in front of you, which is none of those things.

This build is designed at that seam. The **Halo** closes as your order moves. The **tier ring**
fills as you return. The **map** shows the exact hillside your bag came from. And underneath the
motion, the parts a reviewer will actually poke at — pricing, capacity, idempotency — are built so
that two people doing the same thing at the same time cannot corrupt each other.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

**That is the whole setup.** No `.env.local`, no database, no API keys. The catalogue, ordering,
live tracking, reservations, loyalty, the admin queue and the AI Barista all work immediately —
see [Two backends, one contract](#two-backends-one-contract) for how.

```bash
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm test             # 35 domain unit tests, no database
npm run test:concurrency   # the two tests that prove Part 9
npm run motion:lint  # fails the build on easing drift
npm run test:all     # all three
```

To attach a real Postgres, copy `.env.local.example` → `.env.local`, set `DATABASE_URL`, then:

```bash
npm run db:generate && npm run db:migrate && npm run db:seed
```

---

## The motion, in three paragraphs

**Four curves, and only four.** `--ease-aura` is the default and appears by a wide margin.
`--ease-bloom` is a small deliberate overshoot, rationed to three places: add-to-cart, the Halo
ticking up a quadrant, and a map pin dropping. `--ease-settle` is for exits, so departing things
read as departing rather than as reveals played backwards. And `--ease-scrub` is `linear`: anything
driven by an external clock — scroll position, a 2.5s poll, a countdown — gets **no easing curve at
all**, because the scroll *is* the timing function. Easing a scroll-linked animation makes it lag
behind the user's finger, which is the most common reason a scroll site feels off without anyone
being able to say why. `npm run motion:lint` fails the build on any fifth curve.

**One primitive.** Every scroll-triggered content reveal on the site goes through
[`<Reveal>`](src/components/motion/Reveal.tsx) — nine variants, one trigger point (`top 85%`),
`once: true` everywhere, and a total stagger capped at 300ms so a thirty-item grid and a six-item
grid finish in the same window. Grids use `ScrollTrigger.batch`: one trigger for the set, never one
per card. Every animation lives inside a `useGSAP({ scope })` context, which is what makes React
StrictMode's dev double-mount safe instead of quietly stacking duplicate triggers and doubled pin
spacers.

**Three transition families.** Continuity says *"this is the same object, seen closer"* — the menu
card that morphs into the drink detail, and the Halo that survives `confirmation → tracking` as one
continuous object rather than disappearing and reappearing. Hierarchy says *"you moved to a
sibling"*. Ceremony says *"something just completed"* — the 1200ms confirmation beat, the only
transition in the build allowed over 480ms. Everything else gets fade + 12px rise at 320ms.

---

## What is worth looking at

### 1. The atomic capacity check

Two guests tap the last table at the same instant. The naive shape —
`SELECT booked_count` → compare → `UPDATE` — has a window between the read and the write in which
both callers see a free seat. Both succeed. The slot is overbooked.

```sql
UPDATE reservation_slots
   SET booked_count = booked_count + $seats
 WHERE id = $id AND booked_count + $seats <= capacity
RETURNING capacity - booked_count AS remaining;
```

One statement. The `WHERE` clause **is** the capacity check, so there is no window to lose. Zero
rows affected means the slot filled up — a 409, not a corrupted row. Underneath it, a
`CHECK (booked_count <= capacity)` constraint means even a future bug cannot write the bad state.

`npm run test:concurrency` fires a dozen simultaneous bookings at one slot and asserts that exactly
`capacity / party_size` of them win.

### 2. Idempotency with three outcomes

`POST /api/orders` **requires** an `Idempotency-Key`; a request without one is rejected rather than
quietly accepted. The key is claimed with `INSERT … ON CONFLICT (key) DO NOTHING RETURNING *`, and
there are three distinct correct answers:

| Situation | Response |
|---|---|
| First caller | `201` — does the work |
| Same key, same body, already finished | `200` — replays the **original** response |
| Same key, **different** body | `422` — never a silent replay |

That third case is the one most implementations get wrong. It also caught a real bug during this
build: the request hash used `JSON.stringify(payload, Object.keys(payload).sort())`, and the array
form of `stringify`'s second argument is a property allowlist applied at *every* depth — so nested
cart lines were hashing as `{}` and a tampered quantity replayed as identical. Fixed with a
recursive stable stringify; the conflict test exists to keep it fixed.

### 3. Loyalty tier is derived, never stored

Only `users.lifetime_points` exists. There is no `tier` column, so there are never two numbers that
have to agree. [`deriveLoyalty()`](src/domain/loyalty.ts) is called on read, and the four tiers
*are* the four quadrants of the Halo filling in — not a progress bar with a coffee icon next to it.

```bash
curl localhost:3000/api/loyalty/usr-demo
# points 1840 · tier Crema · quadrant 3 · toNext 2160 — and no tier field on the user row
```

### 4. OSRM is called exactly once per order

At confirmation, and the GeoJSON is persisted into `orders.route_geometry`. Every tracking read
after that is pure arithmetic against stored data. A guest refreshing the tracking page two hundred
times generates two hundred database reads and **zero** OSRM requests: the free API's fair-use
limits are respected structurally, not by hoping traffic stays low. `orders.route_source` records
whether OSRM answered or the synthetic bezier fallback ran, so the admin table shows it at a glance.

There is also **no cron, no worker, and no background job** moving orders along. Each order stores a
randomized stage plan once; `deriveTrackingState(order, now)` computes the stage, the courier
position and the ETA from elapsed time. That is why a tracking link survives a cold reload, and why
the simulation is correct even if nobody looks at it for an hour.

### 5. Server-owned pricing

The client runs `priceCart()` for instant feel. The server runs the *same pure function* against the
stored catalogue before anything is written, and the client's number is read only to log a mismatch
before being discarded. A `total = subtotal + tax + delivery_fee + tip - discount` CHECK constraint
is the second line of defence. Money is `integer` minor units (paise) everywhere — there is no
float in the schema, and a review should reject one on sight.

### 6. The honest UPI line

There is no card data anywhere in this system. Not encrypted, not tokenised — those columns do not
exist. Payment is **cash** (confirms instantly, because there is genuinely nothing to verify until
the counter handles it) or **UPI**, where the order sits at `pending_payment` until an admin marks
the transfer as received. `PATCH /api/admin/orders/:n/verify-payment` is the *only* path in the
entire system that can confirm a UPI order.

That verification is manual **by design**. Confirming a UPI transfer automatically needs a
payment-service-provider integration and a registered business, which is out of scope for a project
running against a personal UPI ID. Rather than fake the automation, the flow is honest about what it
is — and it is exactly how a large number of small merchants genuinely take UPI today.

---

## Two backends, one contract

`src/repositories/index.ts` is the only thing services talk to. It has two implementations:

| | `DATABASE_URL` set | `DATABASE_URL` absent |
|---|---|---|
| Storage | PostgreSQL on Neon, via Drizzle | In-process, persisted to `.data/state.json` |
| Schema | [`src/repositories/schema.ts`](src/repositories/schema.ts) — full DDL, indexes, CHECK constraints | Same shapes, same invariants |
| Capacity check | One `UPDATE … WHERE … <= capacity` | One indivisible compare-and-set |
| Idempotency | `ON CONFLICT (key) DO NOTHING` | Same three outcomes |
| Tracking link survives a cold reload | yes | yes |

The in-process adapter is not a stub — it is what lets the whole product, including the motion work
that is the point of the build, be reviewed with `npm install && npm run dev` and nothing else. The
Postgres schema is real, committed, and migrates.

---

## Every external service is free, and key-less

| Concern | Service | Cost | How we stay inside the limits |
|---|---|---|---|
| Map tiles | OpenStreetMap + CARTO Dark | free | One Leaflet component, three call sites; `preferCanvas` |
| Routing | OSRM public API | free | Called **once per order**, geometry persisted |
| Geocoding | Nominatim (+ Photon for autocomplete) | free | Server-side only, real User-Agent, cached forever |
| Weather | Open-Meteo | free | Cached on a 0.1° grid for an hour |
| LLM | Groq (Llama 3.3 70B) | free tier | Rate-limited by a Postgres token bucket; degrades to a local responder |
| Rate limiting | PostgreSQL | free | Replaces the Redis dependency entirely |

There is no Google Maps, no Mapbox, and no key-gated service in `package.json`. Map attribution is
visible on every map instance, which is a licence requirement rather than a nicety.

**The AI Barista does real tool-calling** into the same service layer the REST API uses —
`search_menu`, `add_to_cart`, `check_order`, `check_tables`. Without `GROQ_API_KEY` those tools still
execute for real against the live catalogue; only the language generation falls back to a local
responder, so the recommend → add-to-cart round trip works either way.

---

## Architecture

```
app/          route handlers + pages — thin, no business logic
  ↓
services/     orchestration: order · reservation · catalog · payment · chat
  ↓
domain/       pure functions. no I/O, clock and randomness injected
  ↓
repositories/ the only place that talks to storage
```

The dependency rule points one way. `domain/` imports nothing but other domain modules, which is
why the entire unit suite runs in 160ms with no database and no test framework.

**Motion lives in `components/motion/`** — fifteen primitives, and nothing outside that directory
calls GSAP directly:

| Primitive | What it does |
|---|---|
| `Reveal` | The one content-reveal primitive. Nine variants, `top 85%`, `once`, 300ms stagger cap |
| `SmoothScroll` | Lenis, wired to `ScrollTrigger.update` and the GSAP ticker; both dynamically imported |
| `ViewTransitions` · `PageTransition` | Route morphs, plus the announce/focus/scroll a11y work |
| `HeroScrub` | The 144-frame pinned canvas scrub |
| `PinnedSequence` | Pinned N-beat stepper; sticky media + IntersectionObserver below 640px |
| `DrawPath` | SVG paths that draw against scroll, with a progress callback for annotations |
| `CountUp` | Figures that count up on arrival. Serializable props, so it works straight from RSC |
| `ImageReveal` | `clip-path` wipe with a counter-scale, plus optional parallax drift |
| `Marquee` | Ticker whose direction and speed couple to scroll velocity |
| `ScrollSkew` | Global velocity skew, capped at 4° and decaying — one ticker for the whole page |
| `ScrollScale` · `Parallax` · `HorizontalScroll` | Scrub-linked transform primitives |
| `SplitText` · `NumberRoll` · `Halo` · `SteamCanvas` · `Magnetic` · `ScrollProgress` | Word masks, number rolls, the signature ring, ambient particles, pointer magnetism, header progress |

---

## The hero

A **144-frame scroll-scrubbed macro sequence** — green seed → roast → grind → bloom → pour → the cup
resting in morning light — pinned for 200% of viewport height.

- Frames decode via `createImageBitmap` **off the main thread** and paint straight to a `<canvas>`.
  Never 144 `<img>` tags, and never a `setState` per scroll tick: that is a guaranteed
  dropped-frame machine.
- **144 desktop frames (4.1 MB) / 72 mobile frames at half resolution (1.1 MB)**, chosen at the
  640px breakpoint — comfortably inside the 6 MB / 2.5 MB budget.
- The engine waits for real canvas sizing before its first paint; sizing too early paints into the
  default backing store and stretches frame one.
- A fast scroll can outrun the streaming tail, so `paint()` falls back to the nearest
  already-decoded frame rather than showing an empty canvas.
- **The primary CTA is keyboard-reachable before the scrub finishes.** A pin must never trap a
  keyboard user inside a decorative sequence.
- Under reduced motion the scrub is *kept* — it is scroll-**linked**, not autonomous motion — but
  the copy parallax and the ambient steam are not rendered at all.

> The source render carried placeholder marketing copy burned into frames 145–240, so the scrub uses
> the clean 1–144 range and the real typography is rendered as HTML on top. That is also the correct
> engineering answer: text in a canvas is invisible to search, to translation, and to a screen
> reader.

---

## Scroll choreography, page by page

| Route | Behaviour |
|---|---|
| `/` | Pinned 144-frame scrub → `mask` headline handoff → velocity-coupled marquee → **pinned six-beat ritual sequence** → wipe-revealed origin tiles with capped parallax → **a roast curve that draws itself and lights its own annotations** → three steps with a scrubbed connecting line → counters that count up → batched drink grid → sticky-media manifesto with `clip` reveals → word-by-word tagline. Two pins, inside the three-pin budget |
| `/menu` | Sticky filter that shrinks past 120px; one `ScrollTrigger.batch` for the grid; filter changes leave under `--ease-settle` and enter under `--ease-aura` |
| `/menu/[id]` | Pinned media column with inner parallax; the builder itself has **no** scroll animation — it is a control surface |
| `/origins` | Full-viewport pinned Leaflet map, then a **horizontal pinned scroll** whose pin length is exactly `trackWidth − viewportWidth`. As each story crosses centre the map `flyTo`s that origin. Below 640px the pinning is disabled entirely in favour of a scroll-snap carousel |
| `/credits` | Every photograph, its photographer and its licence — generated from the fetch manifest, not hand-maintained |
| `/guides/[slug]` | Scroll-linked step highlighting at 40% viewport height, a scrubbed progress line, and a sticky timer that is **never** scroll-animated |
| `/track/[n]` | The Halo arrives as a shared element and then tracks `overallProgress`. The poll lands every 2.5s but the ETA, the ring and the timeline rail all **interpolate between polls on a one-second heartbeat**, so the clock counts rather than lurching. A stage boundary flashes the countdown once under `--ease-bloom`. Sticky map; the courier eases **linearly** between polls |
| `/checkout` → placing | A four-beat ceremony that narrates what the server is actually doing — re-pricing, claiming the idempotency key, calling OSRM once, writing the row — with the Halo filling as each lands. The final beat waits on the real response; it never claims success the server has not given |
| `/checkout` | Deliberately restrained. No parallax, no pinning, no scrub. One `fade` per section and a number-rolling total. Animating a checkout is how you lose an order |
| `/admin` | No scroll animation at all, and a 120ms route fade. The motion budget is spent on guests, on purpose |

---

## Accessibility

- **Reduced motion is a policy, not a toggle.** Lenis is switched **off** entirely, not slowed.
  Parallax, steam and cursor effects are not rendered. `<Reveal>` sets its final state instantly via
  `gsap.matchMedia()`. Halo progress still updates but jumps rather than sweeps. Number rolls become
  instant swaps. Page transitions collapse to a 100ms fade — not zero, because an instant swap is
  its own kind of jarring. The result should feel calm and complete, never broken.
- **Client-side navigation is made to speak**: an `aria-live` region announces each new page, focus
  moves to the new `<h1>`, and a skip link is the first focusable element on every page — genuinely
  necessary when the header plus a pinned hero is that much to tab past.
- **The focus indicator is the Halo arc.** Making the signature element do the accessibility work
  means nobody is ever tempted to remove it for looking ugly.
- Colour is never the only channel — sold-out, error and seasonal states carry a glyph or a word.
- Touch targets are ≥44×44px, including slot-grid cells.

---

## Performance

Measured on this build, honestly:

| Metric | Target | Actual |
|---|---|---|
| Hero media | ≤ 6 MB desktop / 2.5 MB mobile | **4.1 MB / 1.1 MB** ✅ |
| Animated properties | `transform` / `opacity` only | ✅ — the Halo's bloom is a pre-blurred layer whose **opacity** animates, never a live blur radius |
| Pinned sections per page | ≤ 3 | ✅ — max 2 (`/` and `/origins`) |
| Parallax displacement | ≤ 15% | ✅ — capped in code, not by convention |
| Easing tokens in the codebase | exactly 4 | ✅ — enforced by `npm run motion:lint` |
| Initial route JS | ≤ 170 KB gz | ❌ **~235 KB gz** — see below |

**The one budget this build does not hit**, stated plainly rather than buried: the Next 16 + React
19 client runtime is ~152 KB gzipped before a line of application code, and GSAP + ScrollTrigger is
another ~43 KB. Application code is the remaining ~40 KB. Leaflet, the AI Barista, the cart drawer
and the entire admin dashboard are all dynamically imported and appear in none of it; Lenis and the
GSAP ticker are imported inside an effect so they never block first paint. GSAP itself is shipped
eagerly on purpose — the scrub is above the fold, and deferring it would trade a bundle number for a
visibly worse first impression. Reaching 170 KB would mean rebuilding the motion system around a
lazily-resolved GSAP, which is a real option and a real trade, not an oversight.

Everything else that protects performance is structural: RSC by default with client components
reserved for the scrub canvas, the GSAP choreography, cart state, the Leaflet map and the chat
widget; `next/font` self-hosted with zero layout shift; explicit `width`/`height` on every image and
a reserved `aspect-ratio` on every map container before the library loads; `ScrollTrigger.refresh()`
after `document.fonts.ready`; and `ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize:
true })` so a mobile URL bar showing and hiding does not refresh every trigger mid-scroll.

---

## API surface

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness + which backend is live |
| `GET` | `/api/menu` · `/api/menu/search?q=` | Catalogue, weighted search |
| `POST` | `/api/menu/quote` | Authoritative price for one Brew Builder configuration |
| `GET` | `/api/content` · `/api/origins` · `/api/origins/[slug]` | Editorial + origins |
| `GET` | `/api/guides` · `/api/guides/[slug]` | Brew guides with step timelines |
| `GET` | `/api/stores` · `/api/stores/nearby?lat=&lng=` | Store locator |
| `GET` | `/api/reservations/availability?date=&storeId=` | Seats left per slot |
| `GET` `POST` `DELETE` | `/api/reservations` · `/api/reservations/[reference]` | Book — **atomic**; look up; cancel |
| `POST` | `/api/orders/preview` | Authoritative cart totals |
| `POST` | `/api/orders` | Place — **requires `Idempotency-Key`** |
| `GET` | `/api/orders/[n]` · `/api/orders/[n]/track` | Snapshot; derived tracking (poll ~2.5s) |
| `POST` | `/api/orders/[n]/cancel` | Cancel until `out_for_delivery` |
| `GET` | `/api/settings/payment` | Public UPI ID, payee name |
| `POST` | `/api/chat` | AI Barista — real tool-calling |
| `GET` | `/api/recommendations` · `/api/weather` · `/api/geocode` | Personalized picks; cached proxies |
| `GET` | `/api/loyalty/[userId]` | Points and **derived** tier |
| `GET` `POST` `PATCH` | `/api/subscriptions` · `/api/reviews` | Standing orders; reviews |
| `PATCH` | `/api/admin/orders/[n]/verify-payment` | **The only path that confirms a UPI order** |
| `POST` | `/api/cron/cleanup` | Sweeps expired idempotency + rate-limit rows |

Postgres has no TTL indexes, so that last route exists and is documented rather than assumed.

---

## Testing

```bash
npm test              # 35 domain tests — pricing arithmetic across every modifier
                      # combination, tier boundaries, state-machine legality,
                      # deterministic delivery plans, tracking at every stage
                      # boundary, UPI payload encoding, route interpolation
npm run test:concurrency   # the two races, each named after the bug it prevents
npm run motion:lint        # zero cubic-bezier() outside tokens.css
```

The domain layer takes every dependency as an argument — including the clock and the source of
randomness — so the suite runs in ~160ms against the app's own TypeScript with no build step and no
test framework. Node's `--experimental-strip-types` plus a 30-line resolver hook is the entire rig.

---

## Licence & credits

**Twelve rooms, six cities.** Bengaluru (5, including the roastery), Mumbai (2), Delhi NCR (2),
Hyderabad, Pune and Chennai. Store pickers group by city, the locator filters by city and flies the
map, and checkout geocodes the delivery address **against the chosen bar's city** — "12 Church St"
is a real address in four of the six. Slot generation covers every active store, and the persisted
state file carries a version plus a coverage check, because a store added after the file was written
would otherwise show no availability forever.

**On the photography.** The 42 site photographs are real, individually-sourced images pulled through
the [Openverse](https://openverse.org) API — an index of openly licensed photography — and
**self-hosted**, not hotlinked, so the site keeps working offline and gains no runtime image
dependency. Every slot is a **distinct photograph** — no image is reused anywhere on the site. They are filtered
to licences that permit commercial use **and** modification (CC0,
Public Domain Mark, CC BY), because every one is cropped and re-encoded here; no-derivatives
licences were excluded for exactly that reason. Most are CC BY, which *requires* attribution — so
`/credits` renders the generated list of photographer, licence and source for all 42, and
`public/img/CREDITS.md` carries the same table.

Unsplash was the first choice, but their site is behind a bot check and programmatic access is meant
to go through an API key, so scraping around it was the wrong way in. Openverse publishes a keyless
API with full creator and licence metadata, which is what makes the credits file possible at all.

The **hero scrub is the exception** and is still the project's own footage: 144 frames of one macro
sequence, which is what makes it a continuous shot rather than a slideshow.

Map data © OpenStreetMap contributors · Tiles by CARTO · Routing by OSRM · Weather by Open-Meteo.
Type: Fraunces, Manrope, IBM Plex Mono — all self-hosted via `next/font`.

Brand, copy and product design are original to this build. Do your own trademark and domain
clearance before using any of it commercially: this is directional brand work, not legal clearance.
