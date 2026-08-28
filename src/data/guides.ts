import type { Guide } from '@/domain/types';

export const GUIDES: Guide[] = [
  {
    id: 'gd-v60',
    slug: 'v60-pour-over',
    method: 'V60 Pour-Over',
    summary:
      'Five pours, one cone, three minutes forty. The method that shows you exactly what you did wrong.',
    ratio: '1 : 16.6 — 15g coffee, 250g water',
    grind: 'Medium-fine, like table salt',
    totalSeconds: 220,
    difficulty: 'medium',
    yieldMl: 230,
    image: '/img/guide-pourover.webp',
    steps: [
      { index: 1, title: 'Rinse and preheat', detail: 'Rinse the paper with the full kettle. It removes the paper taste and brings the cone up to temperature — a cold cone drops your brew water by 4°C in the first pour.', seconds: 20 },
      { index: 2, title: 'Bloom · 50g', detail: 'Pour 50g in a tight spiral and stop. The grounds will swell and hiss — that is trapped CO₂ leaving. Water cannot extract sugar through a gas layer, so this is not a ritual, it is a prerequisite.', seconds: 45 },
      { index: 3, title: 'First pour · to 120g', detail: 'Slow concentric circles from the centre outward, never onto the paper. Keep the bed flat.', seconds: 30 },
      { index: 4, title: 'Second pour · to 190g', detail: 'Same motion. The bed should stay level; a crater on one side means you poured too fast there.', seconds: 30 },
      { index: 5, title: 'Final pour · to 250g', detail: 'Finish in the centre. Give the cone one gentle swirl to knock the high grounds down off the wall.', seconds: 30 },
      { index: 6, title: 'Drawdown', detail: 'Let it run dry. If the bed is flat and the surface is even, your pour was even. If it is a mound on one side, that side under-extracted.', seconds: 65 },
    ],
  },
  {
    id: 'gd-aeropress',
    slug: 'aeropress',
    method: 'AeroPress',
    summary:
      'Inverted, ninety seconds, one firm press. The most forgiving brewer ever made, which is not the same as the least serious.',
    ratio: '1 : 12 — 17g coffee, 200g water',
    grind: 'Medium-fine, slightly finer than filter',
    totalSeconds: 150,
    difficulty: 'easy',
    yieldMl: 190,
    image: '/img/guide-aeropress.webp',
    steps: [
      { index: 1, title: 'Invert and dose', detail: 'Plunger in about 1cm, chamber upside down. 17g of coffee in.', seconds: 15 },
      { index: 2, title: 'Pour to 200g', detail: 'All the water at once, 92°C. Do not be precious about it.', seconds: 15 },
      { index: 3, title: 'Stir and steep', detail: 'Ten gentle stirs, then cap it with a rinsed filter and leave it alone.', seconds: 75 },
      { index: 4, title: 'Flip', detail: 'Confident, quick, over the mug. Hesitation is what makes a mess, not speed.', seconds: 5 },
      { index: 5, title: 'Press', detail: 'Thirty seconds of steady pressure. Stop the moment you hear the hiss — pressing past it pulls bitterness straight through.', seconds: 30 },
    ],
  },
  {
    id: 'gd-french-press',
    slug: 'french-press',
    method: 'French Press',
    summary:
      'Full immersion, no paper, every oil left in. The technique everyone thinks they already know and mostly does wrong.',
    ratio: '1 : 15 — 30g coffee, 450g water',
    grind: 'Coarse, like sea salt',
    totalSeconds: 480,
    difficulty: 'easy',
    yieldMl: 420,
    image: '/img/guide-french-press.webp',
    steps: [
      { index: 1, title: 'Pour and wait', detail: '30g coarse, all 450g of water at 94°C, plunger off. Wait four minutes.', seconds: 240 },
      { index: 2, title: 'Break the crust', detail: 'A crust of grounds forms on top. Stir it once with a spoon and it sinks. This is the step almost everyone skips and it is the one that matters most.', seconds: 15 },
      { index: 3, title: 'Skim the foam', detail: 'Two spoons, skim off the foam and floating fines. This is where most French-press bitterness actually lives.', seconds: 20 },
      { index: 4, title: 'Rest five minutes', detail: 'Leave it. The remaining fines settle to the bottom on their own — better than any filter would do it.', seconds: 300 },
      { index: 5, title: 'Plunge barely, pour slow', detail: 'Push the plunger just below the surface. Do not press to the bottom; you will stir the sediment you just spent five minutes settling.', seconds: 20 },
    ],
  },
  {
    id: 'gd-cold-brew',
    slug: 'cold-brew',
    method: 'Cold Brew',
    summary:
      'Eighteen hours, no heat, no hurry. Chemically a different drink from iced coffee, not a colder version of it.',
    ratio: '1 : 8 concentrate — 100g coffee, 800g water',
    grind: 'Very coarse',
    totalSeconds: 64800,
    difficulty: 'easy',
    yieldMl: 700,
    image: '/img/guide-cold-brew.webp',
    steps: [
      { index: 1, title: 'Combine', detail: '100g very coarse into 800g of room-temperature filtered water. Stir once to wet everything through.', seconds: 60 },
      { index: 2, title: 'Eighteen hours at 4°C', detail: 'Fridge, covered. Room temperature works in twelve but ferments if you forget it; the fridge is more forgiving and tastes cleaner.', seconds: 64_800 },
      { index: 3, title: 'Strain twice', detail: 'Once through a mesh, once through paper. The second pass is what separates cold brew from muddy cold coffee.', seconds: 300 },
      { index: 4, title: 'Dilute to taste', detail: 'Concentrate keeps ten days. Cut 1:1 with water or milk over one large clear cube — small cubes water it down before you have finished.', seconds: 60 },
    ],
  },
  {
    id: 'gd-moka',
    slug: 'moka-pot',
    method: 'Moka Pot',
    summary:
      'Steam pressure and a stovetop. Not espresso, and better when you stop asking it to be.',
    ratio: 'Fill the basket level — roughly 18g',
    grind: 'Fine, but coarser than espresso',
    totalSeconds: 300,
    difficulty: 'exacting',
    yieldMl: 100,
    image: '/img/guide-moka.webp',
    steps: [
      { index: 1, title: 'Pre-boiled water to the valve', detail: 'Hot water in the base, not cold. Starting cold means the coffee sits over a heating element for four minutes and cooks before it brews.', seconds: 30 },
      { index: 2, title: 'Level, never tamp', detail: 'Fill the basket and level it with a finger. Tamping a moka pot builds pressure it was never designed to hold.', seconds: 20 },
      { index: 3, title: 'Medium heat, lid open', detail: 'Watch it. The lid stays open so you can see the moment it starts to run.', seconds: 180 },
      { index: 4, title: 'Pull at the honey stage', detail: 'It runs dark and syrupy first, then goes pale and starts to sputter. Take it off the heat at the colour change and run the base under a cold tap.', seconds: 40 },
      { index: 5, title: 'Serve immediately', detail: 'It keeps extracting in a hot pot. Pour it out.', seconds: 30 },
    ],
  },
];

export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
