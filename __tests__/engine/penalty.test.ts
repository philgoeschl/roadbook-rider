import { computePenalty } from '@/engine/penalty';
import type { Waypoint, SessionEvent } from '@/types';

function makeWaypoint(id: string, mandatory: boolean): Waypoint {
  return {
    id,
    routeId: 'r1',
    index: 0,
    type: mandatory ? 'CP' : 'TR',
    coordinates: { lat: 0, lng: 0 },
    distanceFromPrev: 0,
    triggerRadiusM: 50,
    mandatory,
  };
}

function makeEvent(waypointId: string, type: SessionEvent['type']): SessionEvent {
  return {
    id: `e-${waypointId}-${type}`,
    waypointId,
    type,
    timestamp: Date.now(),
    coordinates: { lat: 0, lng: 0 },
  };
}

const PENALTY = 5 * 60 * 1000; // 5 minutes

describe('computePenalty', () => {
  it('returns zero penalty with no events', () => {
    const waypoints = [makeWaypoint('cp1', true)];
    const result = computePenalty(waypoints, [], PENALTY);
    expect(result.penalizedMisses).toBe(0);
    expect(result.totalPenaltyMs).toBe(0);
  });

  it('returns zero penalty when all mandatory waypoints are passed', () => {
    const waypoints = [makeWaypoint('cp1', true), makeWaypoint('cp2', true)];
    const events = [makeEvent('cp1', 'PASSED'), makeEvent('cp2', 'PASSED')];
    const result = computePenalty(waypoints, events, PENALTY);
    expect(result.penalizedMisses).toBe(0);
    expect(result.totalPenaltyMs).toBe(0);
  });

  it('penalizes a missed mandatory waypoint', () => {
    const waypoints = [makeWaypoint('cp1', true)];
    const events = [makeEvent('cp1', 'MISSED')];
    const result = computePenalty(waypoints, events, PENALTY);
    expect(result.penalizedMisses).toBe(1);
    expect(result.totalPenaltyMs).toBe(PENALTY);
  });

  it('accumulates penalty for multiple missed mandatory waypoints', () => {
    const waypoints = [makeWaypoint('cp1', true), makeWaypoint('cp2', true)];
    const events = [makeEvent('cp1', 'MISSED'), makeEvent('cp2', 'MISSED')];
    const result = computePenalty(waypoints, events, PENALTY);
    expect(result.penalizedMisses).toBe(2);
    expect(result.totalPenaltyMs).toBe(PENALTY * 2);
  });

  it('does not penalize missed non-mandatory waypoints', () => {
    const waypoints = [makeWaypoint('tr1', false)];
    const events = [makeEvent('tr1', 'MISSED')];
    const result = computePenalty(waypoints, events, PENALTY);
    expect(result.penalizedMisses).toBe(0);
    expect(result.totalPenaltyMs).toBe(0);
  });

  it('does not penalize skipped mandatory waypoints', () => {
    const waypoints = [makeWaypoint('cp1', true)];
    const events = [makeEvent('cp1', 'SKIPPED')];
    const result = computePenalty(waypoints, events, PENALTY);
    expect(result.penalizedMisses).toBe(0);
    expect(result.totalPenaltyMs).toBe(0);
  });

  it('handles a mix of mandatory and non-mandatory misses', () => {
    const waypoints = [makeWaypoint('cp1', true), makeWaypoint('tr1', false)];
    const events = [makeEvent('cp1', 'MISSED'), makeEvent('tr1', 'MISSED')];
    const result = computePenalty(waypoints, events, PENALTY);
    expect(result.penalizedMisses).toBe(1);
    expect(result.totalPenaltyMs).toBe(PENALTY);
  });

  it('respects a custom penalty amount', () => {
    const waypoints = [makeWaypoint('cp1', true)];
    const events = [makeEvent('cp1', 'MISSED')];
    const result = computePenalty(waypoints, events, 10 * 60 * 1000);
    expect(result.totalPenaltyMs).toBe(10 * 60 * 1000);
  });
});
