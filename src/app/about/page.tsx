import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { listOrigins, listStores } from '@/repositories';
import { CITIES } from '@/data/stores';
import { BRAND, FAQ, HERO, MANIFESTO, NUMBERS } from '@/data/content';
import { Reveal } from '@/components/motion/Reveal';
import { SplitText } from '@/components/motion/SplitText';
import { Parallax } from '@/components/motion/Parallax';
import { ImageReveal } from '@/components/motion/ImageReveal';
import { CountUp } from '@/components/motion/CountUp';
import { Magnetic } from '@/components/motion/Magnetic';

/**
 * /about is the story page, and a story has an order to it: what we believe,
 * who grows it, where it is drunk, how it is roasted, and where to go next.
 *
 * Every fact on this page is read from `src/data` — the same origins the
 * catalogue serves and the same rooms the finder maps — so the story cannot
 * drift away from the product it describes. Nothing here is written twice:
 * the rooms are indexed, not re-described (that is /locations), and the
 * farmers are introduced, not catalogued (that is /origins).
 */

export const metadata: Metadata = {
  title: 'Our story',
  description: 'The people, the rooms and the roast behind AURA TOAST.',
};

/** The two roast answers from the shared FAQ — asked here, answered once. */
const ROAST_FAQ = FAQ.filter(
  (f) => f.q.startsWith('Do you actually roast') || f.q.startsWith('Is the Mumbai'),
);

/**
 * Alt text describes the photograph, not the record, so it lives with the page
 * that renders it. A slug with no entry falls back to decorative: a wrong
 * description is worse for a screen reader than none at all.
 */
const ORIGIN_ALT: Record<string, string> = {
  chikmagalur: 'Coffee bushes growing under tall shade trees on a forested slope.',
  coorg: 'Ripe red and unripe green cherries on the same branch.',
  araku: 'Cherries drying on a green sheet laid down the middle of a village street.',
  yercaud: 'A farmer reaching up into a coffee tree to check a branch.',
  wayanad: 'A double handful of green, unroasted beans held in two open palms.',
};

/** Splits "1,750m" into the number CountUp animates and the unit it leaves alone. */
function splitNumber(value: string): { n: number; suffix: string } {
  const match = value.match(/^([\d,.]+)(.*)$/);
  if (!match) return { n: 0, suffix: value };
  return { n: Number(match[1].replace(/,/g, '')), suffix: match[2] };
}

/**
 * The section opener, laid out by the shared `.section-head` box. The heading
 * is a SplitText everywhere EXCEPT the page title, which is the LCP element
 * and is never animated (§14.3).
 */
function StoryHead({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="section-head">
      <div className="stack-sm">
        <Reveal variant="fade">
          <p className="eyebrow">{eyebrow}</p>
        </Reveal>
        <SplitText as="h2" text={title} />
        {lede ? (
          <Reveal variant="rise" delay={0.08}>
            <p className="lede">{lede}</p>
          </Reveal>
        ) : null}
      </div>
      {action ? (
        <Link href={action.href} className="link-arrow">
          {action.label}
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}

/** A figure that counts up on arrival. The unit stays put; only the digits move. */
function Ledger({
  items,
}: {
  items: readonly { value: string; label: string; detail: string }[];
}) {
  return (
    <Reveal variant="stagger" className="about-ledger">
      {items.map((item) => {
        const { n, suffix } = splitNumber(item.value);
        return (
          <div key={item.label} className="about-ledger__item">
            <p className="about-ledger__value">
              <CountUp value={n} suffix={suffix} />
            </p>
            <p className="about-ledger__label">{item.label}</p>
            <p className="about-ledger__detail">{item.detail}</p>
          </div>
        );
      })}
    </Reveal>
  );
}

export default async function AboutPage() {
  const [origins, stores] = await Promise.all([listOrigins(), listStores()]);
  // Derived, never typed out: a thirteenth room must not need an edit here.
  const roomCount = stores.filter((s) => s.isActive).length;
  const roastery = stores.find((s) => s.blurb.includes('roastery'));

  return (
    <>
      {/* ── Opener. The h1 is static: it is the LCP element, and the reveal
             happens around it (§14.3, §16.2). ─────────────────────────── */}
      <div className="shell">
        <header className="page-head">
          <Reveal variant="fade">
            <p className="eyebrow">Behind the cup</p>
          </Reveal>
          <h1 className="about-open__title">
            {HERO.headlineLines[0]} <em>{HERO.headlineLines[1]}</em>
          </h1>
          <Reveal variant="rise" delay={0.06}>
            <p className="lede">{BRAND.positioning}</p>
          </Reveal>
        </header>
        <Ledger items={NUMBERS.slice(0, 3)} />
      </div>

      {/* ── What we believe ──────────────────────────────────────────── */}
      <section className="section">
        <div className="shell">
          <div className="about-belief">
            <div className="about-belief__media">
              <ImageReveal direction="up" drift={0.05} className="about-belief__frame">
                <Image
                  src="/img/editorial-grind.webp"
                  alt="Roasted beans cupped in an open palm, close and in black and white."
                  width={1400}
                  height={700}
                  sizes="(max-width: 899px) 92vw, 44vw"
                />
              </ImageReveal>
              <Reveal variant="fade" delay={0.12}>
                <p className="about-caption">{BRAND.tagline}</p>
              </Reveal>
            </div>
            <div className="about-belief__body">
              <Reveal variant="fade">
                <p className="eyebrow">{MANIFESTO.eyebrow}</p>
              </Reveal>
              <SplitText as="h2" text={MANIFESTO.title} />
              {MANIFESTO.paragraphs.slice(0, 2).map((p, i) => (
                <Reveal key={p.slice(0, 24)} variant="clip" delay={i * 0.05}>
                  <p className="lede">{p}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The people. Five farms, in the order the catalogue lists them,
             with the photograph alternating side so the page reads as a
             sequence rather than a grid. ─────────────────────────────── */}
      <section className="section" data-skew>
        <div className="shell">
          <StoryHead
            eyebrow="The people"
            title="Five hillsides, and the five people who decide when to pick."
            lede="Not a region on a bag. A farm, an altitude, a process and a harvest window — and someone whose judgement the cup depends on."
            action={{ href: '/origins', label: 'The five origins' }}
          />
          <div className="about-people">
            {origins.map((o, i) => (
              <article key={o.id} className="about-person" data-flip={i % 2 ? '' : undefined}>
                <ImageReveal
                  direction={i % 2 ? 'right' : 'left'}
                  className="about-person__media"
                >
                  <Parallax amount={0.08}>
                    <Image
                      src={o.heroImage}
                      alt={ORIGIN_ALT[o.slug] ?? ''}
                      width={1200}
                      height={800}
                      sizes="(max-width: 899px) 92vw, 42vw"
                    />
                  </Parallax>
                </ImageReveal>
                <Reveal variant="rise" delay={0.06} className="about-person__body">
                  <p className="about-person__meta mono">
                    {o.altitudeM}m · {o.process} · {o.varietal}
                  </p>
                  <h3>{o.farmerName}</h3>
                  <p className="about-person__where">{o.name}</p>
                  <p className="muted">{o.farmerStory}</p>
                  <p className="about-person__harvest mono">Harvest {o.harvest}</p>
                  <Link href={`/origins?focus=${o.slug}`} className="link-arrow">
                    {o.name.split(',')[0]} in full
                    <span aria-hidden="true">→</span>
                  </Link>
                </Reveal>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── The rooms. Indexed, not described — /locations is the chapter
             on each one, and repeating it here would only let the two
             drift apart. ────────────────────────────────────────────── */}
      <section className="section">
        <div className="shell">
          <div className="about-rooms">
            <div className="about-rooms__body">
              <StoryHead
                eyebrow="The rooms"
                title={`${roomCount} rooms, and not one of them an accident.`}
                lede={`Furniture and light, surface and sound, sourced in pairs — because a room that only looks right still sounds like a corridor. The rooms are spread across ${CITIES.length} cities; the drum stays in one of them.`}
              />
              <Reveal variant="stagger" stagger={0.05} as="ul" className="about-cities">
                {CITIES.map((city) => {
                  const count = stores.filter((s) => s.city === city.name && s.isActive).length;
                  return (
                    <li key={city.slug} className="about-city">
                      <span className="about-city__name">{city.name}</span>
                      <span className="about-city__count mono">
                        {count} {count === 1 ? 'room' : 'rooms'}
                      </span>
                    </li>
                  );
                })}
              </Reveal>
              <Reveal variant="rise" delay={0.1}>
                <Link href="/locations" className="link-arrow">
                  Every room, city by city
                  <span aria-hidden="true">→</span>
                </Link>
              </Reveal>
            </div>
            <div className="about-rooms__media">
              <ImageReveal direction="up" drift={0.04} className="about-rooms__frame">
                <Image
                  src="/img/editorial-craft.webp"
                  alt="A long timber counter with pastries under glass and three people working behind it."
                  width={1400}
                  height={700}
                  sizes="(max-width: 899px) 92vw, 46vw"
                />
              </ImageReveal>
              {roastery ? (
                <Reveal variant="rise" delay={0.08} className="about-note">
                  <p className="about-note__where mono">
                    {roastery.name} · {roastery.city}
                  </p>
                  <p className="muted">{roastery.blurb}</p>
                </Reveal>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── The roast ────────────────────────────────────────────────── */}
      <section className="section" data-skew>
        <div className="shell">
          <StoryHead
            eyebrow="The roast"
            title="One drum. Everything else is patience."
            lede="Nine minutes forty in the drum, then nine days of waiting before an espresso lot is pulled. The figures below are the ones we will not move."
          />
          <ImageReveal direction="up" drift={0.06} className="about-roast__frame">
            <Image
              src="/img/editorial-roast.webp"
              alt="Beans turning in the open drum of a shop roaster, bean temperature showing on the panel behind."
              width={1400}
              height={700}
              sizes="(max-width: 1439px) 92vw, 1376px"
            />
          </ImageReveal>
          <Ledger items={NUMBERS.slice(3)} />
          <div className="about-answers">
            <Reveal variant="stagger" stagger={0.06}>
              {ROAST_FAQ.map((f) => (
                <div key={f.q} className="faq-item">
                  <h3>{f.q}</h3>
                  <p className="muted">{f.a}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── The handoff. The last paragraph of the manifesto is held back
             for exactly this spot. ─────────────────────────────────── */}
      <section className="section about-close">
        <div className="shell">
          <ImageReveal direction="up" drift={0.05} className="about-close__frame">
            <Image
              src="/img/editorial-pour.webp"
              alt="Two cups of milk coffee on a dark table, a leaf poured into the crema of the nearer one."
              width={1400}
              height={700}
              sizes="(max-width: 1439px) 92vw, 1376px"
            />
          </ImageReveal>
          <div className="about-close__body">
            <Reveal variant="fade">
              <p className="eyebrow about-close__eyebrow">Where to next</p>
            </Reveal>
            <SplitText as="h2" text={MANIFESTO.paragraphs[2]} className="about-close__title" />
            <Reveal variant="fade" delay={0.2}>
              <p className="lede about-close__lede">
                The menu names the hillside on every cup. The origins map names the person who
                grew it. Start at whichever end you find more convincing.
              </p>
              <div className="row wrap about-close__ctas">
                <Magnetic>
                  <Link href={HERO.primaryCta.href} className="btn btn--primary btn--lg" prefetch>
                    {HERO.primaryCta.label}
                  </Link>
                </Magnetic>
                <Link href={HERO.secondaryCta.href} className="btn btn--outline btn--lg">
                  {HERO.secondaryCta.label}
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
