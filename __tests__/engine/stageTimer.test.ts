import { computeStageStatus, formatStageDuration } from '@/engine/stageTimer';
import type { Waypoint, SessionEvent } from '@/types';

function makeWaypoint(id: string, type: Waypoint['type']): Waypoint {
  return {
    id,
    routeId: 'r1',
    index: 0,
    type,
    coordinates: { lat: 0, lng: 0 },
    distanceFromPrev: 0,
    triggerRadiusM: 50,
    mandatory: false,
  };
}

function makeEvent(
  id: string,
  waypointId: string,
  type: SessionEvent['type'],
  timestamp: number,
): SessionEvent {
  return { id, waypointId, type, timestamp, coordinates: { lat: 0, lng: 0 } };
}

const waypoints: Waypoint[] = [
  makeWaypoint('ss1', 'SS'),
  makeWaypoint('cp1', 'CP'),
  makeWaypoint('end1', 'SS-END'),
  makeWaypoint('ss2', 'SS'),
  makeWaypoint('end2', 'SS-END'),
];

describe('computeStageStatus', () => {
  it('returns not-in-stage with no completed stages when no events', () => {
    const result = computeStageStatus(waypoints, []);
    expect(result.isInStage).toBe(false);
    expect(result.stageStartMs).toBeNull();
    expect(result.completedStages).toHaveLength(0);
  });

  it('detects rider currently in a stage (SS passed, no SS-END yet)', () => {
    const events = [makeEvent('e1', 'ss1', 'PASSED', 1000)];
    const result = computeStageStatus(waypoints, events);
    expect(result.isInStage).toBe(true);
    expect(result.stageStartMs).toBe(1000);
    expect(result.completedStages).toHaveLength(0);
  });

  it('records a completed stage when SS-END is passed', () => {
    const events = [
      makeEvent('e1', 'ss1', 'PASSED', 1000),
      makeEvent('e2', 'end1', 'PASSED', 5000),
    ];
    const result = computeStageStatus(waypoints, events);
    expect(result.isInStage).toBe(false);
    expect(result.completedStages).toHaveLength(1);
    expect(result.completedStages[0].durationMs).toBe(4000);
    expect(result.completedStages[0].stageNumber).toBe(1);
  });

  it('handles multiple sequential stages', () => {
    const events = [
      makeEvent('e1', 'ss1', 'PASSED', 1000),
      makeEvent('e2', 'end1', 'PASSED', 5000),
      makeEvent('e3', 'ss2', 'PASSED', 8000),
      makeEvent('e4', 'end2', 'PASSED', 14000),
    ];
    const result = computeStageStatus(waypoints, events);
    expect(result.isInStage).toBe(false);
    expect(result.completedStages).toHaveLength(2);
    expect(result.completedStages[0].durationMs).toBe(4000);
    expect(result.completedStages[1].durationMs).toBe(6000);
    expect(result.completedStages[1].stageNumber).toBe(2);
  });

  it('correctly reports in-stage during second stage', () => {
    const events = [
      makeEvent('e1', 'ss1', 'PASSED', 1000),
      makeEvent('e2', 'end1', 'PASSED', 5000),
      makeEvent('e3', 'ss2', 'PASSED', 8000),
    ];
    const result = computeStageStatus(waypoints, events);
    expect(result.isInStage).toBe(true);
    expect(result.stageStartMs).toBe(8000);
    expect(result.completedStages).toHaveLength(1);
  });

  it('ignores non-PASSED events for SS waypoints', () => {
    const events = [makeEvent('e1', 'ss1', 'MISSED', 1000)];
    const result = computeStageStatus(waypoints, events);
    expect(result.isInStage).toBe(false);
    expect(result.completedStages).toHaveLength(0);
  });

  it('ignores orphan SS-END with no preceding SS', () => {
    const events = [makeEvent('e1', 'end1', 'PASSED', 1000)];
    const result = computeStageStatus(waypoints, events);
    expect(result.isInStage).toBe(false);
    expect(result.completedStages).toHaveLength(0);
  });
});

describe('formatStageDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatStageDuration(45_000)).toBe('00:45');
  });

  it('formats minute durations', () => {
    expect(formatStageDuration(4 * 60_000 + 32_000)).toBe('04:32');
  });

  it('formats hour durations', () => {
    expect(formatStageDuration(2 * 3_600_000 + 3 * 60_000 + 7_000)).toBe('2:03:07');
  });
});
