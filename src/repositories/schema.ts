/**
 * Drizzle table definitions — the real PostgreSQL schema (Blueprint §4.2).
 *
 * Money is `integer` minor units (paise) EVERYWHERE. There is no `real`,
 * `double precision`, or `numeric` money column in this file, and a code
 * review should reject one on sight. `double precision` appears only for
 * coordinates, where a float is genuinely correct.
 *
 * This file is the source of truth for `npm run db:generate`. The app can also
 * run against the in-process adapter in `./memory/store.ts`, which implements
 * the same operations with the same atomicity guarantees — see `./index.ts`.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ── ENUMS ──────────────────────────────────────────────────────────── */
export const orderStatus = pgEnum('order_status', [
  'pending_payment',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
]);
export const paymentMethod = pgEnum('payment_method', ['cash', 'upi']);
export const paymentStatus = pgEnum('payment_status', ['pending', 'verified', 'failed']);
export const fulfillmentType = pgEnum('fulfillment_type', ['delivery', 'pickup']);
export const reservationType = pgEnum('reservation_type', ['table', 'event']);
export const reservationStatus = pgEnum('reservation_status', ['booked', 'completed', 'cancelled']);
export const subscriptionCadence = pgEnum('subscription_cadence', ['weekly', 'biweekly', 'monthly']);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'paused', 'cancelled']);
export const roastLevel = pgEnum('roast_level', ['light', 'medium', 'medium_dark', 'dark']);

/* ── AUTH ───────────────────────────────────────────────────────────── */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  // loyalty: ONLY the lifetime total is stored. Tier is DERIVED (§9.4).
  lifetimePoints: integer('lifetime_points').notNull().default(0),
  referralCode: text('referral_code').unique(),
  referredBy: uuid('referred_by'),
  locale: text('locale').notNull().default('en-IN'),
  currency: text('currency').notNull().default('INR'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check('lifetime_points_non_negative', sql`${t.lifetimePoints} >= 0`)]);

export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  label: text('label'),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country').notNull().default('IN'),
  lat: doublePrecision('lat'), // coordinates, not money: float is correct here
  lng: doublePrecision('lng'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ── CATALOGUE ──────────────────────────────────────────────────────── */
export const origins = pgTable('origins', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  altitudeM: integer('altitude_m'),
  process: text('process'),
  farmerName: text('farmer_name'),
  farmerStory: text('farmer_story'),
  varietal: text('varietal'),
  harvest: text('harvest'),
  heroImage: text('hero_image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const drinks = pgTable('drinks', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  originId: uuid('origin_id').references(() => origins.id, { onDelete: 'set null' }),
  roast: roastLevel('roast'),
  description: text('description').notNull(),
  longDescription: text('long_description'),
  tastingNotes: text('tasting_notes').array().notNull().default(sql`'{}'`),
  allergens: text('allergens').array().notNull().default(sql`'{}'`),
  caffeineMg: integer('caffeine_mg').notNull().default(0),
  basePrice: integer('base_price').notNull(), // paise
  imageUrl: text('image_url'),
  isSeasonal: boolean('is_seasonal').notNull().default(false),
  isAvailable: boolean('is_available').notNull().default(true),
  isIced: boolean('is_iced').notNull().default(false),
  intensity: smallint('intensity').notNull().default(3),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('base_price_non_negative', sql`${t.basePrice} >= 0`),
  index('idx_drinks_category').on(t.category, t.sortOrder),
  index('idx_drinks_seasonal').on(t.isSeasonal),
]);

export const modifiers = pgTable('modifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  priceDelta: integer('price_delta').notNull().default(0), // paise, may be negative
  caffeineDelta: integer('caffeine_delta').notNull().default(0),
  isDairyFree: boolean('is_dairy_free').notNull().default(false),
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [
  uniqueIndex('idx_modifiers_kind_slug').on(t.kind, t.slug),
  check('modifier_kind_valid', sql`${t.kind} IN ('size','milk','syrup','shot','temperature')`),
]);

export const drinkModifiers = pgTable('drink_modifiers', {
  drinkId: uuid('drink_id').notNull().references(() => drinks.id, { onDelete: 'cascade' }),
  modifierId: uuid('modifier_id').notNull().references(() => modifiers.id, { onDelete: 'cascade' }),
  isDefault: boolean('is_default').notNull().default(false),
}, (t) => [primaryKey({ columns: [t.drinkId, t.modifierId] })]);

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  phone: text('phone'),
  blurb: text('blurb'),
  hours: jsonb('hours').notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
});

export const guides = pgTable('guides', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  method: text('method').notNull(),
  summary: text('summary').notNull(),
  ratio: text('ratio').notNull(),
  grind: text('grind').notNull(),
  totalSeconds: integer('total_seconds').notNull(),
  difficulty: text('difficulty').notNull(),
  yieldMl: integer('yield_ml').notNull(),
  image: text('image'),
  steps: jsonb('steps').notNull().default(sql`'[]'::jsonb`),
});

export const contentBlocks = pgTable('content_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  section: text('section').notNull(),
  locale: text('locale').notNull().default('en-IN'),
  body: jsonb('body').notNull(),
}, (t) => [uniqueIndex('idx_content_key_locale').on(t.key, t.locale)]);

/* ── ORDERS ─────────────────────────────────────────────────────────── */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // NULL = guest
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  storeId: uuid('store_id').references(() => stores.id),
  fulfillment: fulfillmentType('fulfillment').notNull().default('delivery'),
  addressId: uuid('address_id').references(() => addresses.id),
  addressLine: text('address_line'),
  deliveryLat: doublePrecision('delivery_lat'),
  deliveryLng: doublePrecision('delivery_lng'),

  subtotal: integer('subtotal').notNull(),
  tax: integer('tax').notNull().default(0),
  deliveryFee: integer('delivery_fee').notNull().default(0),
  tip: integer('tip').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),
  currency: text('currency').notNull().default('INR'),

  status: orderStatus('status').notNull().default('pending_payment'),
  paymentMethod: paymentMethod('payment_method').notNull(),
  paymentStatus: paymentStatus('payment_status').notNull().default('pending'),
  upiTransactionRef: text('upi_transaction_ref'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  // the whole delivery simulation lives here, written ONCE at confirmation (§7)
  deliveryPlan: jsonb('delivery_plan'),
  routeGeometry: jsonb('route_geometry'), // GeoJSON LineString from OSRM, persisted
  routeSource: text('route_source'), // 'osrm' | 'synthetic'
  derivedStage: orderStatus('derived_stage'), // lazily written back, never authoritative

  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (t) => [
  check(
    'total_is_consistent',
    sql`${t.total} = ${t.subtotal} + ${t.tax} + ${t.deliveryFee} + ${t.tip} - ${t.discount}`,
  ),
  check('subtotal_non_negative', sql`${t.subtotal} >= 0`),
  check(
    'upi_orders_start_pending',
    sql`${t.paymentMethod} <> 'upi' OR ${t.paymentStatus} <> 'verified' OR ${t.verifiedAt} IS NOT NULL`,
  ),
  index('idx_orders_user_placed').on(t.userId, t.placedAt),
]);

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  drinkId: uuid('drink_id').references(() => drinks.id, { onDelete: 'set null' }),
  nameSnapshot: text('name_snapshot').notNull(), // catalogue can change; receipts cannot
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  modifiers: jsonb('modifiers').notNull().default(sql`'[]'::jsonb`),
}, (t) => [
  check('unit_price_non_negative', sql`${t.unitPrice} >= 0`),
  check('quantity_positive', sql`${t.quantity} > 0`),
  index('idx_order_items_order').on(t.orderId),
]);

/* ── RESERVATIONS — capacity lives on the SLOT, not the booking (§9.2) ─ */
export const reservationSlots = pgTable('reservation_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  slotDate: date('slot_date').notNull(),
  slotTime: time('slot_time').notNull(),
  type: reservationType('type').notNull().default('table'),
  capacity: integer('capacity').notNull(),
  bookedCount: integer('booked_count').notNull().default(0),
  eventTitle: text('event_title'),
  eventPrice: integer('event_price'),
}, (t) => [
  uniqueIndex('idx_slots_lookup').on(t.storeId, t.slotDate, t.slotTime, t.type),
  check('capacity_positive', sql`${t.capacity} > 0`),
  check('booked_non_negative', sql`${t.bookedCount} >= 0`),
  // the invariant, enforced by the database itself
  check('never_overbooked', sql`${t.bookedCount} <= ${t.capacity}`),
]);

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: text('reference').notNull().unique(),
  slotId: uuid('slot_id').notNull().references(() => reservationSlots.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email').notNull(),
  guestPhone: text('guest_phone'),
  partySize: integer('party_size').notNull(),
  notes: text('notes'),
  status: reservationStatus('status').notNull().default('booked'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('party_size_positive', sql`${t.partySize} > 0`),
  index('idx_reservations_slot').on(t.slotId),
]);

/* ── LOYALTY · SUBSCRIPTIONS · REVIEWS ──────────────────────────────── */
export const loyaltyLedger = pgTable('loyalty_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_ledger_user').on(t.userId, t.createdAt)]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  drinkId: uuid('drink_id').references(() => drinks.id, { onDelete: 'set null' }), // NULL = surprise me
  cadence: subscriptionCadence('cadence').notNull(),
  quantity: integer('quantity').notNull().default(1),
  nextDelivery: date('next_delivery').notNull(),
  status: subscriptionStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('sub_quantity_positive', sql`${t.quantity} > 0`),
  index('idx_subs_due').on(t.nextDelivery),
]);

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  drinkId: uuid('drink_id').notNull().references(() => drinks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  author: text('author').notNull(),
  rating: smallint('rating').notNull(),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('rating_range', sql`${t.rating} BETWEEN 1 AND 5`),
  uniqueIndex('idx_reviews_one_per_person').on(t.drinkId, t.userId),
  index('idx_reviews_drink').on(t.drinkId, t.createdAt),
]);

/* ── INFRASTRUCTURE ─────────────────────────────────────────────────── */
export const idempotencyRecords = pgTable('idempotency_records', {
  key: text('key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  statusCode: integer('status_code'),
  response: jsonb('response'),
  state: text('state').notNull().default('in_progress'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '24 hours'`),
}, (t) => [
  check('idem_state_valid', sql`${t.state} IN ('in_progress','completed')`),
  index('idx_idem_expiry').on(t.expiresAt),
]);

export const rateLimits = pgTable('rate_limits', {
  bucket: text('bucket').notNull(), // e.g. 'chat:203.0.113.7'
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.bucket, t.windowStart] }),
  index('idx_ratelimit_window').on(t.windowStart),
]);

export const geocodeCache = pgTable('geocode_cache', {
  query: text('query').primaryKey(), // normalized, lowercased
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const weatherCache = pgTable('weather_cache', {
  gridKey: text('grid_key').primaryKey(), // lat/lng rounded to 0.1°
  payload: jsonb('payload').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionKey: text('session_key').notNull().unique(), // browser id for guests
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  messages: jsonb('messages').notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
