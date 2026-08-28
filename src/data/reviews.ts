import type { Review } from '@/domain/types';

export const SEED_REVIEWS: Review[] = [
  { id: 'rv-1', drinkId: 'drk-halo-espresso', userId: null, author: 'Nikhil R.', rating: 5, body: 'Ordered it expecting chocolate. Got peach. Stood at the bar arguing about it for ten minutes and then ordered another one.', createdAt: '2026-06-14T09:12:00.000Z' },
  { id: 'rv-2', drinkId: 'drk-halo-espresso', userId: null, author: 'Farah A.', rating: 4, body: 'Genuinely acidic — that is a compliment, but know what you are ordering. The double is the right call.', createdAt: '2026-07-02T07:44:00.000Z' },
  { id: 'rv-3', drinkId: 'drk-flat-white', userId: null, author: 'Sanjay M.', rating: 5, body: 'The robusta thing sounded like a gimmick in the description. It is not. Best flat white in the city and it is not close.', createdAt: '2026-07-19T11:02:00.000Z' },
  { id: 'rv-4', drinkId: 'drk-coldbrew', userId: null, author: 'Divya K.', rating: 5, body: 'One big cube. Still tasted like cold brew at the bottom of the glass forty minutes later. Small thing, huge difference.', createdAt: '2026-08-01T14:30:00.000Z' },
  { id: 'rv-5', drinkId: 'drk-pourover', userId: null, author: 'Imran S.', rating: 4, body: 'Four minutes felt long until I watched the bloom. Now I stand there on purpose.', createdAt: '2026-08-06T08:15:00.000Z' },
  { id: 'rv-6', drinkId: 'drk-latte', userId: null, author: 'Ritu B.', rating: 5, body: 'The Coorg natural comes through even at 240ml with oat. I did not think that was possible.', createdAt: '2026-08-09T16:48:00.000Z' },
  { id: 'rv-7', drinkId: 'drk-chai', userId: null, author: 'Aditya P.', rating: 5, body: 'A coffee bar that makes chai properly. Boiled four times, cardamom crushed to order. Respect.', createdAt: '2026-08-11T06:22:00.000Z' },
  { id: 'rv-8', drinkId: 'drk-mocha', userId: null, author: 'Leena T.', rating: 4, body: 'The burnt honey is right at the edge. One degree further and it would be ruined, which is presumably the point.', createdAt: '2026-08-13T13:05:00.000Z' },
  { id: 'rv-9', drinkId: 'drk-cortado', userId: null, author: 'Kabir D.', rating: 5, body: 'Steamed cooler than everyone else does it and you can taste the milk sugar. This is the one I order now.', createdAt: '2026-08-15T10:37:00.000Z' },
  { id: 'rv-10', drinkId: 'drk-aeropress', userId: null, author: 'Meghna V.', rating: 4, body: 'Bought one on the way out. The guide on the site is better than the one in the box.', createdAt: '2026-08-17T09:55:00.000Z' },
];
