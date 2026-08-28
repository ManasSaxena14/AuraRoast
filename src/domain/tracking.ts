/**
 * Stateless tracking derivation (Blueprint §7.1, §7.4).
 *
 * There is no cron, no worker, no background job moving orders along. Every
 * tracking read derives the current stage, courier position and ETA purely
 * from elapsed time against a plan written once at confirmation. That is why a
 * tracking link survives a cold reload and costs nothing to run.
 */
import { interpolateAlongRoute } from '@/lib/geo';
import type { LatLng, Order, OrderStatus, RouteGeometry } from './types';

export interface TrackingState {
  currentStage: OrderStatus;
  stageProgress: number; // 0–1 within the current stage
  overallProgress: number; // 0–1 across the whole plan — drives the Halo
  courierPosition: LatLng | null;
  travelledFraction: number;
  etaMs: number | null;
  stages: { name: OrderStatus; done: boolean; active: boolean; startsAtMs: number }[];
}

export function deriveTrackingState(order: Order, now: number): TrackingState {
  const empty: TrackingState['stages'] = [];

  if (order.status === 'cancelled') {
    return {
      currentStage: 'cancelled',
      stageProgress: 1,
      overallProgress: 1,
      courierPosition: null,
      travelledFraction: 0,
      etaMs: 0,
      stages: empty,
    };
  }

  if (!order.confirmedAt || !order.deliveryPlan) {
    return {
      currentStage: 'pending_payment',
      stageProgress: 0,
      overallProgress: 0,
      courierPosition: startPoint(order.routeGeometry),
      travelledFraction: 0,
      etaMs: null,
      stages: empty,
    };
  }

  const confirmedAt = new Date(order.confirmedAt).getTime();
  const elapsed = Math.max(0, now - confirmedAt);
  const { stages, totalDurationMs } = order.deliveryPlan;

  let cumulative = 0;
  const timeline: TrackingState['stages'] = [];
  let current: OrderStatus = 'delivered';
  let stageProgress = 1;

  for (const stage of stages) {
    const active = elapsed >= cumulative && elapsed < cumulative + stage.durationMs;
    timeline.push({
      name: stage.name,
      done: elapsed >= cumulative + stage.durationMs,
      active,
      startsAtMs: confirmedAt + cumulative,
    });
    if (active && current === 'delivered') {
      current = stage.name;
      stageProgress = (elapsed - cumulative) / stage.durationMs;
    }
    cumulative += stage.durationMs;
  }
  timeline.push({
    name: 'delivered',
    done: elapsed >= totalDurationMs,
    active: elapsed >= totalDurationMs,
    startsAtMs: confirmedAt + totalDurationMs,
  });

  const overallProgress = Math.min(elapsed / totalDurationMs, 1);

  // The courier only moves during the out_for_delivery leg — before that it
  // sits at the store, which is what actually happens.
  const transitStart = stages[0].durationMs + stages[1].durationMs;
  const transitDuration = stages[2].durationMs;
  const travelledFraction =
    elapsed <= transitStart
      ? 0
      : Math.min(1, (elapsed - transitStart) / transitDuration);

  return {
    currentStage: current,
    stageProgress: Math.min(1, Math.max(0, stageProgress)),
    overallProgress,
    courierPosition: interpolateAlongRoute(order.routeGeometry, travelledFraction),
    travelledFraction,
    etaMs: Math.max(0, confirmedAt + totalDurationMs - now),
    stages: timeline,
  };
}

function startPoint(route: RouteGeometry | null): LatLng | null {
  if (!route || route.coordinates.length === 0) return null;
  const [lng, lat] = route.coordinates[0];
  return { lat, lng };
}

export function formatEta(ms: number | null): string {
  if (ms === null) return '—';
  if (ms <= 0) return 'Any moment';
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}
