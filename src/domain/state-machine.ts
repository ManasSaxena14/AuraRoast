/**
 * Order + reservation state machines (Blueprint Part 10).
 * Every `orders.status` write goes through `assertTransition`.
 */
import { IllegalTransitionError } from './errors';
import type { OrderStatus, ReservationStatus, SubscriptionStatus } from './types';

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'], // past this point a guest cannot cancel
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

export function isCancellable(status: OrderStatus): boolean {
  return canTransition(status, 'cancelled');
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  booked: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!RESERVATION_TRANSITIONS[from].includes(to)) throw new IllegalTransitionError(from, to);
}

const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  active: ['paused', 'cancelled'],
  paused: ['active', 'cancelled'],
  cancelled: [],
};

export function assertSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!SUBSCRIPTION_TRANSITIONS[from].includes(to)) throw new IllegalTransitionError(from, to);
}

export const ORDER_STAGE_ORDER: readonly OrderStatus[] = [
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
];

export const ORDER_STAGE_COPY: Record<string, { label: string; detail: string }> = {
  pending_payment: { label: 'Awaiting payment', detail: 'We are watching for your UPI transfer.' },
  confirmed: { label: 'Order received', detail: 'The bar has your ticket.' },
  preparing: { label: 'On the bar', detail: 'Grinding, dosing, pulling.' },
  out_for_delivery: { label: 'On the way', detail: 'Your courier is moving.' },
  delivered: { label: 'Delivered', detail: 'Drink it while the crema holds.' },
  cancelled: { label: 'Cancelled', detail: 'Nothing was charged.' },
};
