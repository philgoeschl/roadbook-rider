import { useState, useEffect } from 'react';
import { computeStageStatus, type CompletedStage } from '@/engine/stageTimer';
import type { Waypoint, SessionEvent } from '@/types';

export interface StageTimerState {
  isInStage: boolean;
  elapsedMs: number;
  completedStages: CompletedStage[];
}

export function useStageTimer(
  waypoints: Waypoint[],
  events: SessionEvent[],
): StageTimerState {
  const { isInStage, stageStartMs, completedStages } = computeStageStatus(waypoints, events);

  const [elapsedMs, setElapsedMs] = useState(
    isInStage && stageStartMs !== null ? Date.now() - stageStartMs : 0,
  );

  useEffect(() => {
    if (!isInStage || stageStartMs === null) {
      setElapsedMs(0);
      return;
    }
    // Sync immediately, then tick every second
    setElapsedMs(Date.now() - stageStartMs);
    const interval = setInterval(() => setElapsedMs(Date.now() - stageStartMs!), 1000);
    return () => clearInterval(interval);
  }, [isInStage, stageStartMs]);

  return { isInStage, elapsedMs, completedStages };
}
