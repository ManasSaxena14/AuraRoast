/** Editorial blocks keyed by section — the CMS layer, seeded (Blueprint §2.1). */
export const BRAND = {
  name: 'AURA TOAST',
  tagline: 'Atmospheric Craft, Pure Origin',
  positioning:
    'Coffee is two things at once: a material fact and a felt atmosphere. A bean has an origin, an altitude, a farmer, a roast curve — all measurable, all true. And then there is what happens in the room when it lands in front of you, which is none of those things. AURA TOAST is built at that seam.',
} as const;

export const HERO = {
  eyebrow: 'Single origin · Twelve rooms · One roastery',
  headlineLines: ['The atmosphere', 'and the act.'],
  sub: 'A green seed, one irreversible minute of heat, and the room it changes. Twelve rooms, one drum, five named farms. Scroll and watch it happen.',
  primaryCta: { label: 'Open the menu', href: '/menu' },
  secondaryCta: { label: 'See where it grows', href: '/origins' },
  scrollHint: 'Scroll',
} as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Choose the origin',
    body: 'Every drink on the menu names the hillside it came from, the altitude, the process and the person who grew it. Not a region. A person.',
    href: '/origins',
    linkLabel: 'The five origins',
  },
  {
    step: '02',
    title: 'Build the cup',
    body: 'Size, milk, shots, syrup, temperature. The tasting notes and the caffeine estimate update as you tap, because a preview you have to imagine is not a preview.',
    href: '/menu',
    linkLabel: 'Start building',
  },
  {
    step: '03',
    title: 'Watch it come',
    body: 'A real road route, fetched once and stored, with the courier moving along it and a Halo closing as the order advances. The clock counts down every second, not every poll.',
    // Never a hardcoded order number here: a fresh install has no orders, and
    // a 404 on the landing page is a bad first impression.
    href: '/account',
    linkLabel: 'Your orders',
  },
] as const;

export const MANIFESTO = {
  eyebrow: 'What we actually believe',
  title: 'Atmosphere is not decoration.',
  paragraphs: [
    'A café is a machine for producing a feeling, and most of them are tuned badly. Too bright, too loud, chairs designed to be sat in for eleven minutes. The coffee is often fine. The room is doing nothing.',
    'We build the room first. The light, the surfaces, the distance between the grinder and the person waiting. Then we put a very good cup into it, from a farm we can name, roasted by someone whose initials are on the bag.',
    'Both halves, or neither is worth much.',
  ],
} as const;

export const NUMBERS = [
  { value: '5', label: 'Origins', detail: 'Named farms, not regions' },
  { value: '12', label: 'Rooms', detail: 'Six cities, one roastery' },
  { value: '1,750m', label: 'Highest lot', detail: 'Baba Budan slopes' },
  { value: '9 days', label: 'Rest before pull', detail: 'Espresso lots only' },
  { value: '18h', label: 'Cold brew steep', detail: 'Never heated, not once' },
  { value: '28s', label: 'Espresso window', detail: 'Sour before, ash after' },
] as const;

export const FOOTER_NOTE =
  'Maps © OpenStreetMap contributors · Tiles by CARTO · Routing by OSRM · Weather by Open-Meteo. Photography via Openverse under CC0 and CC BY — full credits at /credits. Every external service in this build is free and key-less by design.';

export const FAQ = [
  {
    q: 'Why does a filter coffee take four minutes?',
    a: 'Because it is being made, not poured. A V60 is five separate pours with a bloom in between. We could batch-brew it at six in the morning and hand it to you instantly; it would be worse and you would be able to tell.',
  },
  {
    q: 'Do you actually roast here?',
    a: 'One drum, in Koramangala, Tuesday and Friday. Everything served in Mumbai, Delhi, Hyderabad, Pune and Chennai left that room the same week — we would rather move coffee than open a second roastery and pretend the two taste alike. Bags carry a roast date rather than a best-before, because coffee does not expire, it just stops being interesting.',
  },
  {
    q: 'Is the robusta a cost decision?',
    a: 'No. Elsamma Joseph\'s CxR costs us more per kilo than two of our arabicas. It is on the menu because it holds up under milk in a way the arabicas do not.',
  },
  {
    q: 'Can I pay by card?',
    a: 'Cash or UPI. There is no card data anywhere in this system — not encrypted, not tokenised, simply absent. UPI transfers are verified by a human at our end, usually within a few minutes.',
  },
  {
    q: 'Is the Mumbai coffee the same as the Bengaluru coffee?',
    a: 'Same lots, same drum, same week. We ship roasted rather than open a second roastery, because two roasters never produce the same cup and pretending otherwise is how chains end up tasting of nothing. The trade-off is real: coffee flown to Delhi is two days older than coffee walked across Koramangala, which is why every bag carries a roast date and we would rather you notice.',
  },
  {
    q: 'Why does the site animate so much?',
    a: 'Because the product is half atmosphere, and a static page argues the opposite. Every motion here is tied to something true — a value changing, an order advancing, a spatial relationship between two screens. Turn on reduced motion and the whole thing goes calm without going broken; that is the actual test.',
  },
] as const;
