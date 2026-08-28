import type { Paise } from './money';

export type RoastLevel = 'light' | 'medium' | 'medium_dark' | 'dark';
export type ModifierKind = 'size' | 'milk' | 'syrup' | 'shot' | 'temperature';
export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';
export type PaymentMethod = 'cash' | 'upi';
export type PaymentStatus = 'pending' | 'verified' | 'failed';
export type FulfillmentType = 'delivery' | 'pickup';
export type ReservationType = 'table' | 'event';
export type ReservationStatus = 'booked' | 'completed' | 'cancelled';
export type SubscriptionCadence = 'weekly' | 'biweekly' | 'monthly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Origin {
  id: string;
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  altitudeM: number;
  process: string;
  farmerName: string;
  farmerStory: string;
  heroImage: string;
  varietal: string;
  harvest: string;
}

export interface Modifier {
  id: string;
  kind: ModifierKind;
  slug: string;
  label: string;
  priceDelta: Paise;
  caffeineDelta: number;
  isDairyFree: boolean;
  sortOrder: number;
  note?: string;
}

export interface Drink {
  id: string;
  slug: string;
  name: string;
  category: string;
  originId: string | null;
  roast: RoastLevel | null;
  description: string;
  longDescription: string;
  tastingNotes: string[];
  allergens: string[];
  caffeineMg: number;
  basePrice: Paise;
  imageUrl: string;
  isSeasonal: boolean;
  isAvailable: boolean;
  isIced: boolean;
  intensity: number; // 1–5, drives the intensity meter
  sortOrder: number;
  allowedModifiers: ModifierKind[];
  defaultModifiers: Record<string, string>;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone: string;
  hours: Record<string, [string, string]>;
  isActive: boolean;
  blurb: string;
}

export interface GuideStep {
  index: number;
  title: string;
  detail: string;
  seconds: number;
}

export interface Guide {
  id: string;
  slug: string;
  method: string;
  summary: string;
  ratio: string;
  grind: string;
  totalSeconds: number;
  difficulty: 'easy' | 'medium' | 'exacting';
  yieldMl: number;
  image: string;
  steps: GuideStep[];
}

export interface SelectedModifier {
  kind: ModifierKind;
  slug: string;
  label: string;
  priceDelta: Paise;
  caffeineDelta: number;
}

export interface CartLine {
  lineId: string;
  drinkId: string;
  slug: string;
  name: string;
  imageUrl: string;
  quantity: number;
  modifiers: SelectedModifier[];
}

export interface PricedLine {
  lineId: string;
  drinkId: string;
  name: string;
  unitPrice: Paise;
  quantity: number;
  lineTotal: Paise;
  modifiers: SelectedModifier[];
  caffeineMg: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: Paise;
  tax: Paise;
  deliveryFee: Paise;
  tip: Paise;
  discount: Paise;
  total: Paise;
  currency: string;
  caffeineMg: number;
}

export interface DeliveryStage {
  name: Exclude<OrderStatus, 'pending_payment' | 'cancelled' | 'delivered'>;
  durationMs: number;
}

export interface DeliveryPlan {
  stages: DeliveryStage[];
  totalDurationMs: number;
  distanceKm: number;
  trafficMultiplier: number;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface OrderItem {
  id: string;
  drinkId: string | null;
  nameSnapshot: string;
  unitPrice: Paise;
  quantity: number;
  modifiers: SelectedModifier[];
  lineTotal: Paise;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  storeId: string | null;
  fulfillment: FulfillmentType;
  addressLine: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  subtotal: Paise;
  tax: Paise;
  deliveryFee: Paise;
  tip: Paise;
  discount: Paise;
  total: Paise;
  currency: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  upiTransactionRef: string | null;
  verifiedAt: string | null;
  deliveryPlan: DeliveryPlan | null;
  routeGeometry: RouteGeometry | null;
  routeSource: 'osrm' | 'synthetic' | null;
  derivedStage: OrderStatus | null;
  placedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
}

export interface ReservationSlot {
  id: string;
  storeId: string;
  slotDate: string; // YYYY-MM-DD
  slotTime: string; // HH:MM
  type: ReservationType;
  capacity: number;
  bookedCount: number;
  eventTitle?: string;
  eventPrice?: Paise;
}

export interface Reservation {
  id: string;
  reference: string;
  slotId: string;
  userId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  partySize: number;
  notes: string | null;
  status: ReservationStatus;
  createdAt: string;
  slot?: ReservationSlot;
  store?: Store;
}

export interface Review {
  id: string;
  drinkId: string;
  userId: string | null;
  author: string;
  rating: number;
  body: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  drinkId: string | null;
  cadence: SubscriptionCadence;
  quantity: number;
  nextDelivery: string;
  status: SubscriptionStatus;
  createdAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  userId: string;
  orderId: string | null;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  lifetimePoints: number;
  referralCode: string;
  locale: string;
  currency: string;
  isAdmin: boolean;
  createdAt: string;
}
