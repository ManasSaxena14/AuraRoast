import Image from 'next/image';
import Link from 'next/link';
import { listDrinks, listOrigins } from '@/repositories';
import { MANIFESTO, NUMBERS, FAQ } from '@/data/content';
import { RITUAL } from '@/data/ritual';
import { Reveal } from '@/components/motion/Reveal';
import { SplitText } from '@/components/motion/SplitText';
import { Parallax } from '@/components/motion/Parallax';
import { Halo } from '@/components/motion/Halo';
import { CountUp } from '@/components/motion/CountUp';
import { ImageReveal } from '@/components/motion/ImageReveal';
import { PinnedSequence } from '@/components/motion/PinnedSequence';
import { Magnetic } from '@/components/motion/Magnetic';
import { SectionHead } from '@/components/ui/bits';
import { Hero } from '@/components/home/Hero';
import { Steps } from '@/components/home/Steps';
import { DrinkRail } from '@/components/home/DrinkRail';
import { RoastCurve } from '@/components/home/RoastCurve';
import { BrandMarquee } from '@/components/home/BrandMarquee';

/** Splits "1,750m" into the number to animate and the unit to leave alone. */
function splitNumber(value: string): { n: number; suffix: string } {
  const match = value.match(/^([\d,.]+)(.*)$/);
  if (!match) return { n: 0, suffix: value };
  return { n: Number(match[1].replace(/,/g, '')), suffix: match[2] };
}

export default async function HomePage() {
  const [drinks, origins] = await Promise.all([listDrinks(), listOrigins()]);
  const signature = drinks.filter((d) => d.isAvailable).slice(0, 6);

  return (
    <>
      <Hero />

      {/* Hero → content handoff: the headline reveals as the pin releases. */}
      <section id="after-hero" className="section" data-skew>
        <div className="shell">
          <div className="grid-2" style={{ alignItems: 'end' }}>
            <SplitText
              as="h2"
              text="Two things at once: a material fact and a felt atmosphere."
              className="hero-handoff"
            />
            <Reveal variant="rise" delay={0.1}>
              <p className="lede">
                A bean has an origin, an altitude, a farmer, a roast curve — all measurable, all
                true. And then there is what happens in the room when it lands in front of you,
                which is none of those things. We are built at that seam.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* A ticker that leans whichever way you are scrolling. */}
      <BrandMarquee />

      {/* THE RITUAL — pinned six-beat sequence. */}
      <PinnedSequence
        beats={RITUAL}
        eyebrow="Seed to room"
        heading="Six things happen. Five of them are measurable."
      />

      {/* Featured origins strip — wipe reveal + capped parallax. */}
      <section className="section" data-skew>
        <div className="shell">
          <SectionHead
            eyebrow="Pure origin"
            title="Five hillsides, named."
            lede="Not a region on a bag. A person, an altitude, a process and a harvest window."
            action={{ href: '/origins', label: 'Walk the map' }}
          />
          <div className="origin-strip">
            {origins.map((o, i) => (
              <Link key={o.id} href={`/origins?focus=${o.slug}`} className="origin-tile">
                <ImageReveal direction={i % 2 ? 'down' : 'up'} delay={i * 0.06} className="origin-tile__wipe">
                  <Parallax amount={0.12}>
                    <Image
                      src={o.heroImage}
                      alt=""
                      width={1200}
                      height={800}
                      sizes="(max-width: 639px) 90vw, 22vw"
                    />
                  </Parallax>
                </ImageReveal>
                <div className="origin-tile__body">
                  <span className="origin-tile__meta">
                    {o.altitudeM}m · {o.process}
                  </span>
                  <span className="origin-tile__name">{o.name.split(',')[0]}</span>
                  <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                    {o.farmerName}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* THE ROAST CURVE — an SVG that draws itself against the scroll. */}
      <section className="section">
        <div className="shell">
          <RoastCurve />
        </div>
      </section>

      {/* How it works — steps stagger, a connecting line draws under scrub. */}
      <section className="section" data-skew>
        <div className="shell">
          <SectionHead
            eyebrow="How it works"
            title="Three steps, no ceremony."
            lede="Choose the origin, build the cup, watch it come."
          />
          <Steps />
        </div>
      </section>

      {/* Numbers — each one counts up on arrival. */}
      <section className="section section--flush">
        <div className="shell">
          <Reveal variant="stagger" className="numbers">
            {NUMBERS.map((n) => {
              const { n: value, suffix } = splitNumber(n.value);
              return (
                <div key={n.label}>
                  <p className="number__value">
                    <CountUp value={value} suffix={suffix} />
                  </p>
                  <p className="number__label">{n.label}</p>
                  <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
                    {n.detail}
                  </p>
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Signature drinks — ScrollTrigger.batch, one trigger for the set. */}
      <section className="section" data-skew>
        <div className="shell">
          <SectionHead
            eyebrow="Atmospheric craft"
            title="What is on the bar."
            lede="Sixteen ways to drink five origins. Every one names where it came from."
            action={{ href: '/menu', label: 'The full menu' }}
          />
          <DrinkRail drinks={signature} />
        </div>
      </section>

      {/* Manifesto — the media column is CSS-sticky (no extra GSAP pin, so the
          page stays inside the three-pin budget) while the copy scrolls past. */}
      <section className="section">
        <div className="shell">
          <div className="manifesto">
            <div className="manifesto__sticky">
              <Reveal variant="rise" className="stack-sm">
                <p className="eyebrow">{MANIFESTO.eyebrow}</p>
                <h2>{MANIFESTO.title}</h2>
              </Reveal>
              <ImageReveal direction="up" drift={0.06} className="manifesto__media">
                <Image src="/img/editorial-table.webp" alt="" width={900} height={1000} sizes="(max-width: 899px) 90vw, 38vw" />
              </ImageReveal>
              <Halo size={92} stroke={1.6} progress={0.75} />
            </div>
            <div className="manifesto__body">
              {MANIFESTO.paragraphs.map((p, i) => (
                <Reveal key={p.slice(0, 24)} variant="clip" delay={i * 0.05}>
                  <p className="lede">{p}</p>
                </Reveal>
              ))}
              <Reveal variant="stagger" stagger={0.05} className="manifesto__pills">
                {['No spinners', 'No card data', 'No paid APIs', 'No fake automation'].map((t) => (
                  <span key={t} className="chip chip--static">
                    {t}
                  </span>
                ))}
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" data-skew>
        <div className="shell shell--narrow">
          <SectionHead eyebrow="Asked often" title="Straight answers." />
          <Reveal variant="stagger" stagger={0.06}>
            {FAQ.map((f) => (
              <div key={f.q} className="faq-item">
                <h3>{f.q}</h3>
                <p className="muted">{f.a}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* The tagline — words reveal one at a time, 60ms apart. */}
      <section className="tagline">
        <div className="shell shell--narrow">
          <SplitText as="h2" text="Atmospheric Craft, Pure Origin" stagger={0.06} />
          <Reveal variant="fade" delay={0.4}>
            <p className="lede" style={{ marginInline: 'auto', marginTop: 'var(--space-5)' }}>
              The craft you can feel, and the origin you can verify. Both halves, or neither is
              worth much.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <Magnetic>
                <Link href="/menu" className="btn btn--primary btn--lg" prefetch>
                  Start an order
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
