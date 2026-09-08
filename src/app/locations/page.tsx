import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CITIES, STORES, storesByCity } from '@/data/stores';
import type { Store } from '@/domain/types';
import { Reveal } from '@/components/motion/Reveal';
import { SplitText } from '@/components/motion/SplitText';
import { Parallax } from '@/components/motion/Parallax';
import { ImageReveal } from '@/components/motion/ImageReveal';
import { CountUp } from '@/components/motion/CountUp';
import { Magnetic } from '@/components/motion/Magnetic';
import { SectionHead } from '@/components/ui/bits';

/**
 * /locations is the editorial half of the pair, not a second locator.
 *
 * /stores answers "which room, right now": a Leaflet map, sort-by-nearest, an
 * open/closed badge read off the IST clock. It is a tool, and it is stateful.
 * This page answers the slower question — where we are, why each room is where
 * it is, and what hour it actually opens — as six chapters you read top to
 * bottom. Every fact below is derived from the same `src/data/stores.ts` the
 * finder uses, so the two pages cannot drift apart, and the only interaction
 * here is a link into the finder when the guest wants the map.
 */

export const metadata: Metadata = {
  title: 'Locations',
  description:
    'Twelve rooms across six cities, city by city — what each room is for, and the hours it keeps.',
};

const DAYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
] as const;

/** One editorial photograph per chapter, chosen for what the room actually is. */
const CITY_IMAGE: Record<string, string> = {
  bengaluru: '/img/editorial-roast.webp',
  mumbai: '/img/editorial-table.webp',
  delhi: '/img/editorial-craft.webp',
  hyderabad: '/img/editorial-pour.webp',
  pune: '/img/editorial-grind.webp',
  chennai: '/img/editorial-bloom.webp',
};

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Seven identical-looking rows is a table nobody reads. Consecutive days that
 * keep the same hours collapse into one line, so a room states itself in three
 * or four — the point of printing hours at all is that they can be scanned.
 */
function hourRows(hours: Store['hours']) {
  const rows: { days: string; time: string }[] = [];
  let start = 0;

  DAYS.forEach(([key], i) => {
    const current = hours[key];
    const next = i < DAYS.length - 1 ? hours[DAYS[i + 1][0]] : undefined;
    if (current && next && current[0] === next[0] && current[1] === next[1]) return;

    rows.push({
      days: start === i ? DAYS[i][1] : `${DAYS[start][1]}–${DAYS[i][1]}`,
      time: current ? `${current[0]}–${current[1]}` : 'Closed',
    });
    start = i + 1;
  });

  return rows;
}

/** Earliest door and latest last-pour across a set of rooms. */
function bookends(stores: Store[]) {
  const all = stores.flatMap((s) => Object.values(s.hours));
  return {
    first: all.reduce((a, [open]) => (minutes(open) < minutes(a) ? open : a), '23:59'),
    last: all.reduce((a, [, close]) => (minutes(close) > minutes(a) ? close : a), '00:00'),
  };
}

export default function LocationsPage() {
  const groups = storesByCity();
  const day = bookends(STORES);

  const constants = [
    {
      title: 'One drum',
      body: `Every one of the ${STORES.length} rooms is served from the roastery in Koramangala. Roasted Tuesday and Friday, and on a truck or a plane the same week — nothing sits in a warehouse.`,
    },
    {
      title: 'One card',
      body: 'The same menu and the same prices in every city. A cortado in Fort costs what a cortado in Whitefield costs, and both name the hillside it came from.',
    },
    {
      title: 'One number each',
      body: 'Every room answers its own phone, printed above alongside its own hours. Nobody is routed to a call centre, and nobody is told to check the website.',
    },
  ];

  return (
    <>
      {/* The <h1> is the LCP element and is left alone (§16.2). Everything
          around it reveals; the headline itself simply arrives. */}
      <header className="shell page-head">
        <Reveal variant="fade">
          <p className="eyebrow">Where we are</p>
        </Reveal>
        <h1>Six cities, read one at a time.</h1>
        <Reveal variant="rise" delay={0.06}>
          <p className="lede">
            Twelve rooms, six cities, one drum. This is the long version — what each room is for,
            which hour it opens, and why we put it where we did. If you want the short version,
            which room is nearest and which one is pouring right now, that is a different page and
            it has a map.
          </p>
        </Reveal>

        <Reveal variant="stagger" as="dl" stagger={0.06} className="loc-stats">
          <div>
            <dt>Rooms</dt>
            <dd>
              <CountUp value={STORES.length} duration={1} />
            </dd>
          </div>
          <div>
            <dt>Cities</dt>
            <dd>
              <CountUp value={CITIES.length} duration={1} />
            </dd>
          </div>
          <div>
            <dt>First cup</dt>
            <dd>{day.first}</dd>
          </div>
          <div>
            <dt>Last pour</dt>
            <dd>{day.last}</dd>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.12}>
          <p className="muted loc-head__note">
            Looking for the nearest room, or the one that is open at this hour?{' '}
            <Link href="/stores" className="link-inline">
              Open the finder
            </Link>{' '}
            — it has the map, the live hours and sort-by-nearest.
          </p>
        </Reveal>
      </header>

      {/* Contents. Six chapters, and how many rooms each one holds. */}
      <section className="section section--flush" data-skew>
        <div className="shell">
          <nav aria-label="Cities on this page">
            <Reveal variant="stagger" stagger={0.05} className="loc-index">
              {groups.map((g, i) => (
                <a key={g.slug} href={`#${g.slug}`} className="loc-index__link">
                  <span className="loc-index__num mono">{String(i + 1).padStart(2, '0')}</span>
                  <span className="loc-index__city">{g.name}</span>
                  <span className="loc-index__count mono">
                    {g.stores.length} {g.stores.length === 1 ? 'room' : 'rooms'}
                  </span>
                </a>
              ))}
            </Reveal>
          </nav>
        </div>
      </section>

      {/* The chapters. No [data-skew] here — the aside is CSS-sticky, and a
          transform on its ancestor would drag it around every frame. */}
      {groups.map((g, i) => {
        const cityDay = bookends(g.stores);
        return (
          <section key={g.slug} id={g.slug} className="section loc-city">
            <div className="shell">
              <div className="loc-city__grid">
                <div className="loc-city__aside">
                  <p className="loc-city__num mono">
                    {String(i + 1).padStart(2, '0')} / {String(groups.length).padStart(2, '0')}
                  </p>
                  <SplitText as="h2" text={g.name} className="loc-city__name" />
                  <Reveal variant="rise" delay={0.08}>
                    <p className="lede">{g.note}</p>
                  </Reveal>

                  <ImageReveal
                    direction={i % 2 ? 'down' : 'up'}
                    className="loc-city__media"
                    delay={0.05}
                  >
                    <Parallax amount={0.08}>
                      <Image
                        src={CITY_IMAGE[g.slug]}
                        alt=""
                        width={1400}
                        height={700}
                        sizes="(max-width: 899px) 92vw, 32vw"
                      />
                    </Parallax>
                  </ImageReveal>

                  <Reveal variant="fade" delay={0.06}>
                    <dl className="loc-city__facts">
                      <div>
                        <dt>Rooms</dt>
                        <dd>{String(g.stores.length).padStart(2, '0')}</dd>
                      </div>
                      <div>
                        <dt>First cup</dt>
                        <dd>{cityDay.first}</dd>
                      </div>
                      <div>
                        <dt>Last pour</dt>
                        <dd>{cityDay.last}</dd>
                      </div>
                    </dl>
                  </Reveal>
                </div>

                <div className="loc-city__main">
                  <Reveal variant="stagger" as="ol" stagger={0.06} className="loc-rooms">
                    {g.stores.map((s) => (
                      <li key={s.id} className="loc-room">
                        <div className="loc-room__head">
                          <h3>{s.name}</h3>
                          <p className="loc-room__addr mono">{s.address}</p>
                        </div>
                        <p className="loc-room__blurb">{s.blurb}</p>
                        <dl className="loc-hours">
                          {hourRows(s.hours).map((r) => (
                            <div key={r.days}>
                              <dt>{r.days}</dt>
                              <dd>{r.time}</dd>
                            </div>
                          ))}
                        </dl>
                        <a className="loc-room__tel mono" href={`tel:${s.phone.replace(/\s/g, '')}`}>
                          {s.phone}
                        </a>
                      </li>
                    ))}
                  </Reveal>

                  <Reveal variant="fade" delay={0.1}>
                    <Link href="/stores" className="link-arrow">
                      Find these on the map
                      <span aria-hidden="true">→</span>
                    </Link>
                  </Reveal>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* What a directory usually leaves out: the part that is identical. */}
      <section className="section" data-skew>
        <div className="shell">
          <SectionHead
            eyebrow="The constants"
            title="What does not change between rooms."
            lede="The rooms are different on purpose. Three things are not, and they are the three worth knowing before you walk into any of them."
            action={{ href: '/stores', label: 'Open the finder' }}
          />
          <Reveal variant="stagger" stagger={0.06} className="loc-constants">
            {constants.map((c) => (
              <article key={c.title} className="loc-constant">
                <h3>{c.title}</h3>
                <p className="muted">{c.body}</p>
              </article>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="shell loc-outro">
        <SplitText as="h2" text="Come and sit in one." stagger={0.06} />
        <Reveal variant="fade" delay={0.3}>
          <p className="lede loc-outro__lede">
            The finder will tell you which room is closest and whether it is still pouring. A table
            can be held in any of them.
          </p>
          <div className="row wrap loc-outro__ctas">
            <Magnetic>
              <Link href="/stores" className="btn btn--primary btn--lg" prefetch>
                Open the finder
              </Link>
            </Magnetic>
            <Link href="/reservations" className="btn btn--outline btn--lg" prefetch>
              Reserve a table
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
