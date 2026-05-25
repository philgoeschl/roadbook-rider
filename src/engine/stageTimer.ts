import type { Waypoint, SessionEvent } from '@/types';

export interface CompletedStage {
  stageNumber: number;
  durationMs: number;
  startedAt: number;
  endedAt: number;
}

export interface StageStatus {
  isInStage: boolean;
  stageStartMs: number | null;
  completedStages: CompletedStage[];
}

export function computeStageStatus(
  waypoints: Waypoint[],
  events: SessionEvent[],
): StageStatus {
  const typeById = new Map(waypoints.map((w) => [w.id, w.type]));

  // Only PASSED events for SS / SS-END waypoints, in chronological order
  const stageEvents = events
    .filter((e) => e.type === 'PASSED' && (typeById.get(e.waypointId) === 'SS' || typeById.get(e.waypointId) === 'SS-END'))
    .sort((a, b) => a.timestamp - b.timestamp);

  const completedStages: CompletedStage[] = [];
  let stageNumber = 0;
  let i = 0;

  while (i < stageEvents.length) {
    const e = stageEvents[i];

    if (typeById.get(e.waypointId) === 'SS') {
      const ssStart = e.timestamp;
      const endIdx = stageEvents.findIndex((ev, idx) => idx > i && typeById.get(ev.waypointId) === 'SS-END');

      if (endIdx !== -1) {
        stageNumber++;
        completedStages.push({
          stageNumber,
          durationMs: stageEvents[endIdx].timestamp - ssStart,
          startedAt: ssStart,
          endedAt: stageEvents[endIdx].timestamp,
        });
        i = endIdx + 1;
      } else {
        // SS with no matching SS-END yet — rider is currently in this stage
        return { isInStage: true, stageStartMs: ssStart, completedStages };
      }
    } else {
      // Orphan SS-END (no preceding SS) — skip
      i++;
    }
  }

  return { isInStage: false, stageStartMs: null, completedStages };
}

export function formatStageDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
