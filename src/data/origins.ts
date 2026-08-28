import type { Origin } from '@/domain/types';

/** Five real coffee-growing regions of southern India. Coordinates are real. */
export const ORIGINS: Origin[] = [
  {
    id: 'org-chikmagalur',
    slug: 'chikmagalur',
    name: 'Chikmagalur, Karnataka',
    country: 'India',
    lat: 13.3161,
    lng: 75.772,
    altitudeM: 1750,
    process: 'Washed',
    farmerName: 'Rukmini Gowda',
    varietal: 'Sln. 9 · Kent',
    harvest: 'December – February',
    farmerStory:
      'Rukmini took over eleven acres on the Baba Budan slopes in 2009, the year the rains came late and everyone else stripped early. She waited. Her cherries ripened three weeks behind the district and cupped four points above it. She has waited every year since. The washed lots off her upper block are why our house espresso tastes like stone fruit rather than chocolate — a thing guests argue with us about until they try it black.',
    heroImage: '/img/origin-chikmagalur.webp',
  },
  {
    id: 'org-coorg',
    slug: 'coorg',
    name: 'Kodagu (Coorg), Karnataka',
    country: 'India',
    lat: 12.3375,
    lng: 75.8069,
    altitudeM: 1100,
    process: 'Natural',
    farmerName: 'Ayyappa Machaiah',
    varietal: 'Cauvery · S795',
    harvest: 'November – January',
    farmerStory:
      'Ayyappa dries on raised beds under pepper vines, which is inconvenient, slower, and the entire point. The shade holds drying to fourteen days instead of eight, and the fruit stays with the seed long enough to leave something behind. What it leaves behind is jackfruit and dark sugar. He calls the method letting it argue with itself for a while.',
    heroImage: '/img/origin-coorg.webp',
  },
  {
    id: 'org-araku',
    slug: 'araku',
    name: 'Araku Valley, Andhra Pradesh',
    country: 'India',
    lat: 18.3273,
    lng: 82.8752,
    altitudeM: 1100,
    process: 'Honey',
    farmerName: 'Sarita Pangi',
    varietal: 'Selection 5B',
    harvest: 'December – March',
    farmerStory:
      'Araku is farmed by tribal cooperatives on plots that average under two acres. Sarita coordinates forty of them. The honey process here is not a trend imported from Costa Rica — it is what happens when you have no water to spare and a great deal of sun. The cup arrives with a syrup weight and a red-apple sharpness we have never reproduced anywhere else in the country.',
    heroImage: '/img/origin-araku.webp',
  },
  {
    id: 'org-yercaud',
    slug: 'yercaud',
    name: 'Yercaud, Tamil Nadu',
    country: 'India',
    lat: 11.775,
    lng: 78.2095,
    altitudeM: 1400,
    process: 'Washed',
    farmerName: 'Devaraj Selvam',
    varietal: 'Chandragiri',
    harvest: 'December – February',
    farmerStory:
      'The Shevaroy hills sit in a rain shadow, which makes Yercaud a difficult place to grow coffee and an excellent one to grow it carefully. Devaraj replanted his lower block to Chandragiri after leaf rust took the old Kents in 2014. Six years of nothing. The first full harvest cupped 86. He keeps the rust-scarred stump of the oldest tree at the edge of the drying patio, on purpose.',
    heroImage: '/img/origin-yercaud.webp',
  },
  {
    id: 'org-wayanad',
    slug: 'wayanad',
    name: 'Wayanad, Kerala',
    country: 'India',
    lat: 11.6854,
    lng: 76.132,
    altitudeM: 900,
    process: 'Washed Robusta',
    farmerName: 'Elsamma Joseph',
    varietal: 'CxR Robusta',
    harvest: 'January – March',
    farmerStory:
      'We put a robusta on the menu and were told, politely and repeatedly, that we should not have. Elsamma processes hers like an arabica — floated, depulped within four hours, fermented eighteen, dried slow. It comes out heavy, low-acid and clean, with a cocoa-nib bitterness that holds under milk better than anything else we buy. It is the backbone of the house blend and we are not sorry.',
    heroImage: '/img/origin-wayanad.webp',
  },
];

export const ORIGIN_BY_SLUG = new Map(ORIGINS.map((o) => [o.slug, o]));
export const ORIGIN_BY_ID = new Map(ORIGINS.map((o) => [o.id, o]));
