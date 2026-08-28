import type { Beat } from '@/components/motion/PinnedSequence';

/** Six beats, pinned. The same arc the hero scrub runs, told in words. */
export const RITUAL: Beat[] = [
  {
    id: 'seed',
    image: '/img/ritual-1-seed.webp',
    step: '01',
    title: 'A seed, not a bean',
    body: 'What arrives is pale, dense and grassy. It smells of hay. Nothing about it suggests coffee, and nothing about it is edible yet.',
  },
  {
    id: 'roast',
    image: '/img/ritual-2-roast.webp',
    step: '02',
    title: 'Nine minutes forty',
    body: 'Heat drives the moisture off, then the sugars start to caramelise. At 196°C the cell walls fail audibly. That crack is the point of no return.',
  },
  {
    id: 'grind',
    image: '/img/ritual-3-grind.webp',
    step: '03',
    title: 'Ground to order',
    body: 'Coffee loses most of its aromatics within thirty minutes of grinding. Pre-ground is a convenience we are not willing to sell you.',
  },
  {
    id: 'bloom',
    image: '/img/ritual-4-bloom.webp',
    step: '04',
    title: 'The bloom',
    body: 'The first pour makes the bed swell and hiss — trapped CO₂ leaving. Water cannot extract sugar through a gas layer, so this is a prerequisite, not a ritual.',
  },
  {
    id: 'pour',
    image: '/img/ritual-5-pour.webp',
    step: '05',
    title: 'Twenty-eight seconds',
    body: 'Eighteen grams in, thirty-six out. Faster and it is sour, slower and it is ash. The window is genuinely that narrow.',
  },
  {
    id: 'rest',
    image: '/img/ritual-6-rest.webp',
    step: '06',
    title: 'And then the room',
    body: 'Everything above is measurable. What happens when it lands in front of you is not, and it is half of why you came.',
  },
];
