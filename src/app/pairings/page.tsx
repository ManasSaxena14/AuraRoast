import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PAIRINGS, PAIRING_BY_ID } from '@/data/pairings';
import { formatMoney } from '@/domain/money';
import type { Pairing } from '@/domain/types';
import { Reveal } from '@/components/motion/Reveal';
import { SplitText } from '@/components/motion/SplitText';
import { ImageReveal } from '@/components/motion/ImageReveal';
import { Magnetic } from '@/components/motion/Magnetic';

export const metadata: Metadata = {
  title: 'Pairings',
  description: 'Twelve plates, grouped by the coffee each one was chosen against.',
};

/**
 * Names, photography, prices and allergens all come from `src/data/pairings.ts`,
 * so a plate edited there changes here. This page used to carry its own copy of
 * the twelve, which drifted until three of its images were dead while the module
 * was still fine — hence one source of truth and nothing but the editorial layer
 * below.
 *
 * What the module has no field for is which drink on the bar a plate was chosen
 * against, and the one line that says why. Keyed by id rather than name, so a
 * rename in the module cannot silently orphan a note. Drink names are the real
 * menu names (`src/data/drinks.ts`) — the old page invented "Caffè Latte",
 * "Double Espresso" and "Iced Americano", none of which we sell.
 */
const EDITORIAL: Record<string, { drink: string; note: string }> = {
  'prn-biscotti': {
    drink: 'Halo Espresso',
    note: 'The bitterness of the bean meets the caramelised crunch. A morning ritual in two bites.',
  },
  'prn-tiramisu': {
    drink: 'Halo Espresso',
    note: 'Espresso-soaked layers, mascarpone set just. One spoonful, no cutlery politics.',
  },
  'prn-shortbread': {
    drink: 'Long Black',
    note: 'Floral notes lift the jasmine in Yercaud Chandragiri. Aromatic, not sweet.',
  },
  'prn-tart': {
    drink: 'Cortado',
    note: 'Salt makes sweet taste sweeter and coffee taste brighter. The cortado agrees.',
  },
  'prn-croissant': {
    drink: 'Flat White',
    note: 'Butter and pastry are the original pairing. The flat white simply modernises the moment.',
  },
  'prn-pannacotta': {
    drink: 'Aura Latte',
    note: 'Silky milk meets silkier cream. The panna cotta is a latte you eat with a spoon.',
  },
  'prn-mousse': {
    drink: 'Burnt Honey Mocha',
    note: 'Chocolate in the cup, chocolate on the plate. Honest, and heavier than it looks.',
  },
  'prn-painperdu': {
    drink: 'Cardamom Cutting Chai',
    note: 'Spice in the cup, spice in the syrup. Brioche-soaked comfort for the monsoon morning.',
  },
  'prn-madeleine': {
    drink: 'V60 Pour-Over',
    note: 'Grassy bitterness in the cup, grassy sweetness in the hand. Light roast, light bite.',
  },
  'prn-brownie': {
    drink: 'Cold Brew',
    note: 'Coffee inside and outside. The cold brew cuts through fudge like water through paper.',
  },
  'prn-macaron': {
    drink: 'Chemex Carafe',
    note: 'Built on the same bean. A meringue conversation between sweet and bitter.',
  },
  'prn-cheesecake': {
    drink: 'Cold Brew',
    note: 'Tropical acidity wakes the palate between sips. Bright, tart, clean.',
  },
};

/**
 * Grouped by what is in the cup rather than what is on the plate, because that
 * is the order a guest actually decides in: they have already chosen the drink.
 * Filter and cold share a family — both are bright, both fail against sugar for
 * the same reason — which also keeps the three groups at 3 / 5 / 4 rather than
 * leaving two of four sections with a single pairing in them.
 */
const FAMILIES = [
  {
    slug: 'espresso',
    index: '01',
    label: 'Espresso',
    eyebrow: 'Against espresso',
    title: 'Bitter wants crunch, not comfort.',
    blurb:
      'Nine bars for twenty-eight seconds leaves the coffee nowhere to hide, and a soft plate beside it reads as an apology. Dry, dark and short is the answer.',
    ids: ['prn-biscotti', 'prn-tiramisu', 'prn-shortbread'],
  },
  {
    slug: 'milk',
    index: '02',
    label: 'Milk',
    eyebrow: 'Against milk',
    title: 'Texture answering texture.',
    blurb:
      // Sixty millilitres of MILK against a double, steamed to 55°C — see the
      // Cortado entry in src/data/drinks.ts. The earlier wording said sixty
      // millilitres of coffee, which is the opposite of what we actually pour.
      'A cortado is sixty millilitres of milk against a double, steamed cooler than most bars manage. When the cup is already soft, the plate is free to be soft back.',
    ids: ['prn-tart', 'prn-croissant', 'prn-pannacotta', 'prn-mousse', 'prn-painperdu'],
  },
  {
    slug: 'clear',
    index: '03',
    label: 'Filter & cold',
    eyebrow: 'Against filter and cold',
    title: 'Acidity is a knife. Give it something to cut.',
    blurb:
      'Light roasts and cold builds carry acidity the way a white wall carries light. Some plates get lost against that; these four get sharper.',
    ids: ['prn-madeleine', 'prn-brownie', 'prn-macaron', 'prn-cheesecake'],
  },
] as const;

/**
 * The module ships every plate at `w=600`, which is right for the thumbnails in
 * the drink sheet it was written for and about half of what a lead photograph
 * here needs. Widening the query is a derived read of the module's URL, not a
 * second copy of it — anything that is not an Unsplash `w=` URL (a future local
 * `/img/…` asset, say) passes straight through.
 */
function atWidth(url: string, width: number): string {
  return url.startsWith('https://images.unsplash.com/')
    ? url.replace(/([?&]w=)\d+/, `$1${width}`)
    : url;
}

/** One running 01–12 across the whole page, so the index reads as an index. */
const ORDER = FAMILIES.flatMap((f) => f.ids as readonly string[]);
const numberOf = (id: string) => String(ORDER.indexOf(id) + 1).padStart(2, '0');

/**
 * A plate reaches this page only if the module still has it, it is available,
 * and it has an editorial line. Anything added to the module without one is
 * simply not shown — the page is an argument, not a catalogue dump.
 */
function membersOf(ids: readonly string[]): Pairing[] {
  return ids
    .map((id) => PAIRING_BY_ID.get(id))
    // `p !== undefined`, not `Boolean(p)` — only the former narrows the type,
    // so the two property reads after it are what the compiler objected to.
    .filter((p): p is Pairing => p !== undefined && p.isAvailable && Boolean(EDITORIAL[p.id]));
}

/** The mono line above every plate: its number, and the drink it answers to. */
function Rail({ p }: { p: Pairing }) {
  const { drink } = EDITORIAL[p.id];
  return (
    <p className="pairing__rail">
      <span className="pairing__no">{numberOf(p.id)}</span>
      <Link
        href={`/menu?q=${encodeURIComponent(drink)}`}
        className="pairing__drink"
        prefetch={false}
      >
        <span className="sr-only">Find </span>
        {drink}
        <span className="sr-only"> on the menu</span>
        <span className="pairing__arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </p>
  );
}

function Meta({ p }: { p: Pairing }) {
  return (
    <div className="pairing__meta">
      <p className="pairing__price mono">{formatMoney(p.price)}</p>
      <p className="pairing__allergens mono">
        {p.allergens.length ? p.allergens.join(' · ') : 'no listed allergens'}
      </p>
    </div>
  );
}

export default function PairingsPage() {
  const total = PAIRINGS.filter((p) => p.isAvailable).length;

  return (
    <>
      <div className="shell">
        <header className="page-head pairings-head">
          <Reveal variant="fade">
            <p className="eyebrow">From the kitchen</p>
          </Reveal>
          {/* Static on purpose — this is the LCP element (§14.3). */}
          <h1>Twelve plates, chosen against a cup.</h1>
          <Reveal variant="rise" delay={0.06}>
            <p className="lede">
              Nothing here is a dessert menu. Every plate was tasted beside one specific drink on
              the bar and kept only when it made the coffee better. {total} made it.
            </p>
          </Reveal>
          <Reveal variant="rise" delay={0.12}>
            <nav className="pairing-index" aria-label="Pairing families">
              {FAMILIES.map((f) => (
                <a key={f.slug} href={`#${f.slug}`}>
                  <span className="pairing-index__no">{f.index}</span>
                  <span>{f.label}</span>
                  <span className="pairing-index__count">{f.ids.length}</span>
                </a>
              ))}
            </nav>
          </Reveal>
        </header>
      </div>

      {FAMILIES.map((family, fi) => {
        const [lead, ...rest] = membersOf(family.ids);
        if (!lead) return null;

        return (
          <section key={family.slug} id={family.slug} className="section pairing-family" data-skew>
            <div className="shell">
              <div className="pairing-family__head">
                {/* The zero-JS scroll layer (§14.5) — an eyebrow does not
                    warrant a ScrollTrigger of its own. */}
                <p className="eyebrow scroll-rise">{family.eyebrow}</p>
                <SplitText as="h2" text={family.title} />
                <Reveal variant="rise" delay={0.08}>
                  <p className="lede">{family.blurb}</p>
                </Reveal>
              </div>

              {/* One plate per family gets the room to be a photograph. The
                  drift is the only scrubbed effect on the page — three of them,
                  not twelve, because this is a list and not a showcase. */}
              <article className="pairing pairing--lead">
                <ImageReveal
                  direction={fi % 2 ? 'down' : 'up'}
                  drift={0.05}
                  className="pairing__media pairing__media--lead"
                >
                  {/* alt="" throughout: the plate's name is the heading beside
                      it, and an alt repeating it only makes a screen reader
                      say the same words twice. */}
                  <div className="pairing__frame">
                    <Image
                      src={atWidth(lead.imageUrl, 1400)}
                      alt=""
                      fill
                      sizes="(max-width: 899px) 92vw, 52vw"
                    />
                  </div>
                </ImageReveal>
                <Reveal variant="rise" delay={0.1} className="pairing__body">
                  <Rail p={lead} />
                  <h3 className="pairing__name pairing__name--lead">{lead.name}</h3>
                  <p className="pairing__note lede">{EDITORIAL[lead.id].note}</p>
                  <p className="pairing__desc muted">{lead.description}</p>
                  <Meta p={lead} />
                </Reveal>
              </article>

              {rest.length ? (
                <Reveal as="ul" variant="stagger" stagger={0.06} className="pairing-list">
                  {rest.map((p) => (
                    <li key={p.id} className="pairing pairing--row">
                      <div className="pairing__media pairing__media--row">
                        <Image
                          src={p.imageUrl}
                          alt=""
                          fill
                          sizes="(max-width: 559px) 92vw, (max-width: 899px) 132px, 160px"
                        />
                      </div>
                      <div className="pairing__body">
                        <Rail p={p} />
                        <h3 className="pairing__name">{p.name}</h3>
                        <p className="pairing__note">{EDITORIAL[p.id].note}</p>
                        <p className="pairing__desc muted">{p.description}</p>
                      </div>
                      <Meta p={p} />
                    </li>
                  ))}
                </Reveal>
              ) : null}
            </div>
          </section>
        );
      })}

      <div className="shell">
        <Reveal variant="fade">
          <p className="pairings-note mono muted">
            Allergens are listed per plate. Everything is finished in one kitchen, and that kitchen
            handles gluten, dairy, eggs and nuts.
          </p>
        </Reveal>
      </div>

      <section className="tagline">
        <div className="shell shell--narrow">
          <SplitText as="h2" text="A cup is half a course." stagger={0.06} />
          <Reveal variant="fade" delay={0.3}>
            <p className="lede" style={{ marginInline: 'auto', marginTop: 'var(--space-5)' }}>
              The other half is on this page. Order both, or the pairing stays a theory.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <Magnetic>
                <Link href="/menu" className="btn btn--primary btn--lg" prefetch>
                  Build the cup
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
