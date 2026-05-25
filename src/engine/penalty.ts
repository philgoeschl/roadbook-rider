import type { Waypoint, SessionEvent } from '@/types';

export interface PenaltyResult {
  totalPenaltyMs: number;
  penalizedMisses: number;
}

export function computePenalty(
  waypoints: Waypoint[],
  events: SessionEvent[],
  penaltyPerMissMs: number,
): PenaltyResult {
  const mandatoryIds = new Set(
    waypoints.filter((w) => w.mandatory).map((w) => w.id),
  );
  const penalizedMisses = events.filter(
    (e) => e.type === 'MISSED' && mandatoryIds.has(e.waypointId),
  ).length;
  return {
    totalPenaltyMs: penalizedMisses * penaltyPerMissMs,
    penalizedMisses,
  };
}
