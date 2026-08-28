import type { Store } from '@/domain/types';

/**
 * Eleven bars across six cities. Coordinates are real, and each room gets a
 * line that says what is actually different about it — a locator where every
 * entry reads "great coffee, warm atmosphere" is a locator nobody reads twice.
 */
const STANDARD: Record<string, [string, string]> = {
  mon: ['07:30', '21:00'],
  tue: ['07:30', '21:00'],
  wed: ['07:30', '21:00'],
  thu: ['07:30', '21:00'],
  fri: ['07:30', '22:00'],
  sat: ['08:00', '22:00'],
  sun: ['08:00', '20:00'],
};

const EARLY: Record<string, [string, string]> = {
  ...STANDARD,
  mon: ['07:00', '20:00'],
  tue: ['07:00', '20:00'],
  wed: ['07:00', '20:00'],
  thu: ['07:00', '20:00'],
  fri: ['07:00', '21:00'],
};

const LATE: Record<string, [string, string]> = {
  ...STANDARD,
  fri: ['08:00', '23:30'],
  sat: ['08:30', '23:30'],
  sun: ['08:30', '22:00'],
};

export const CITIES = [
  { slug: 'bengaluru', name: 'Bengaluru', note: 'Where the roastery is. Five rooms.' },
  { slug: 'mumbai', name: 'Mumbai', note: 'Two rooms, both loud in the right way.' },
  { slug: 'delhi', name: 'Delhi NCR', note: 'Two rooms, one of them all glass.' },
  { slug: 'hyderabad', name: 'Hyderabad', note: 'One room, the best light we have.' },
  { slug: 'pune', name: 'Pune', note: 'One room, and a cupping table.' },
  { slug: 'chennai', name: 'Chennai', note: 'One room, filter country.' },
] as const;

export const STORES: Store[] = [
  /* ── Bengaluru ─────────────────────────────────────────────────── */
  {
    id: 'str-indiranagar',
    slug: 'indiranagar',
    name: 'Indiranagar',
    address: '412, 12th Main Rd, Indiranagar, Bengaluru 560038',
    city: 'Bengaluru',
    lat: 12.9719,
    lng: 77.6412,
    phone: '+91 80 4114 2200',
    hours: STANDARD,
    isActive: true,
    blurb: 'The first bar. Two grinders, one window, morning light until eleven.',
  },
  {
    id: 'str-koramangala',
    slug: 'koramangala',
    name: 'Koramangala',
    address: '78, 5th Block, Koramangala, Bengaluru 560095',
    city: 'Bengaluru',
    lat: 12.9345,
    lng: 77.6266,
    phone: '+91 80 4114 2201',
    hours: LATE,
    isActive: true,
    blurb: 'The roastery is here. If you smell first crack on a Tuesday, that is why.',
  },
  {
    id: 'str-jayanagar',
    slug: 'jayanagar',
    name: 'Jayanagar',
    address: '9, 4th Block, Jayanagar, Bengaluru 560011',
    city: 'Bengaluru',
    lat: 12.925,
    lng: 77.5938,
    phone: '+91 80 4114 2202',
    hours: STANDARD,
    isActive: true,
    blurb: 'Smallest room, best filter bar. Cuppings on Saturday at nine.',
  },
  {
    id: 'str-whitefield',
    slug: 'whitefield',
    name: 'Whitefield',
    address: 'Ground Floor, ITPL Main Rd, Whitefield, Bengaluru 560066',
    city: 'Bengaluru',
    lat: 12.9698,
    lng: 77.75,
    phone: '+91 80 4114 2203',
    hours: EARLY,
    isActive: true,
    blurb: 'Built for the 8am queue. Four-group machine, two baristas, no small talk.',
  },
  {
    id: 'str-malleshwaram',
    slug: 'malleshwaram',
    name: 'Malleshwaram',
    address: '14, 8th Cross, Malleshwaram, Bengaluru 560003',
    city: 'Bengaluru',
    lat: 13.0068,
    lng: 77.5692,
    phone: '+91 80 4114 2204',
    hours: EARLY,
    isActive: true,
    blurb: 'A hundred-year-old floor and a very new grinder. Opens before the market does.',
  },

  /* ── Mumbai ────────────────────────────────────────────────────── */
  {
    id: 'str-bandra',
    slug: 'bandra',
    name: 'Bandra West',
    address: '31, Waterfield Rd, Bandra West, Mumbai 400050',
    city: 'Mumbai',
    lat: 19.0606,
    lng: 72.8296,
    phone: '+91 22 4114 2210',
    hours: LATE,
    isActive: true,
    blurb: 'Two floors, a courtyard, and the only bar of ours with a proper afternoon crowd.',
  },
  {
    id: 'str-fort',
    slug: 'fort',
    name: 'Fort',
    address: '5, Rope Walk Ln, Kala Ghoda, Fort, Mumbai 400001',
    city: 'Mumbai',
    lat: 18.9295,
    lng: 72.8318,
    phone: '+91 22 4114 2211',
    hours: EARLY,
    isActive: true,
    blurb: 'Stone arches, terrible acoustics, excellent espresso. Closed to laptops after noon.',
  },

  /* ── Delhi NCR ─────────────────────────────────────────────────── */
  {
    id: 'str-khan-market',
    slug: 'khan-market',
    name: 'Khan Market',
    address: '48, Middle Ln, Khan Market, New Delhi 110003',
    city: 'Delhi NCR',
    lat: 28.5994,
    lng: 77.2273,
    phone: '+91 11 4114 2220',
    hours: STANDARD,
    isActive: true,
    blurb: 'Twelve seats and a queue. Order at the window if the room looks full — it is.',
  },
  {
    id: 'str-cyber-hub',
    slug: 'cyber-hub',
    name: 'Cyber Hub, Gurugram',
    address: 'Building 10, DLF Cyber City, Gurugram 122002',
    city: 'Delhi NCR',
    lat: 28.4949,
    lng: 77.089,
    phone: '+91 124 4114 2221',
    hours: EARLY,
    isActive: true,
    blurb: 'All glass, all morning. The 8:40 rush clears 200 cups and we still weigh every dose.',
  },

  /* ── Hyderabad · Pune · Chennai ────────────────────────────────── */
  {
    id: 'str-jubilee-hills',
    slug: 'jubilee-hills',
    name: 'Jubilee Hills',
    address: 'Road No. 36, Jubilee Hills, Hyderabad 500033',
    city: 'Hyderabad',
    lat: 17.4326,
    lng: 78.4071,
    phone: '+91 40 4114 2230',
    hours: LATE,
    isActive: true,
    blurb: 'West-facing, so the last hour of light lands on the bar. Worth timing.',
  },
  {
    id: 'str-koregaon-park',
    slug: 'koregaon-park',
    name: 'Koregaon Park',
    address: 'Lane 7, Koregaon Park, Pune 411001',
    city: 'Pune',
    lat: 18.5362,
    lng: 73.8939,
    phone: '+91 20 4114 2240',
    hours: STANDARD,
    isActive: true,
    blurb: 'A cupping table in the middle of the room, used most Wednesdays. Sit at it.',
  },
  {
    id: 'str-nungambakkam',
    slug: 'nungambakkam',
    name: 'Nungambakkam',
    address: '22, Khader Nawaz Khan Rd, Nungambakkam, Chennai 600006',
    city: 'Chennai',
    lat: 13.0569,
    lng: 80.2425,
    phone: '+91 44 4114 2250',
    hours: EARLY,
    isActive: true,
    blurb: 'Filter country, so we make ours the local way too — and put it on the menu properly.',
  },
];

export const STORE_BY_SLUG = new Map(STORES.map((s) => [s.slug, s]));
export const STORE_BY_ID = new Map(STORES.map((s) => [s.id, s]));
export const DEFAULT_STORE = STORES[0];

/** Stores grouped by city, in CITIES order — used by every store picker. */
export function storesByCity(stores: Store[] = STORES) {
  return CITIES.map((city) => ({
    ...city,
    stores: stores.filter((s) => s.city === city.name),
  })).filter((g) => g.stores.length > 0);
}
