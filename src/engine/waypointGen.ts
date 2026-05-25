import * as turf from '@turf/turf';
import type { WaypointType, Waypoint } from '@/types';

// Lower number = higher merge priority
const WAYPOINT_PRIORITY: Record<WaypointType, number> = {
  UT: 1,
  HR: 1,
  HL: 1,
  TR: 2,
  TL: 2,
  CP: 3,
  TC: 3,
  SS: 3,
  'SS-END': 3,
  RB: 4,
  FRK: 4,
  KR: 5,
  KL: 5,
  FUEL: 6,
  MED: 6,
  SRV: 6,
  CAMP: 6,
  PARK: 6,
  'CAU-CROSS': 7,
  'CAU-ROCK': 7,
  'CAU-TRACK': 7,
  'CAU-PASS': 7,
  'CAU-SLICK': 7,
  'CAU-BUMP': 7,
  'CAU-ROAD': 7,
  'CAU-TRAFFIC': 7,
  GO: 8,
  PHOTO: 8,
  INFO: 8,
  WPT: 8,
  HDG: 9,
  DST: 9,
};

const MANDATORY_TYPES: Set<WaypointType> = new Set(['CP', 'TC', 'SS', 'SS-END']);

interface WaypointCandidate {
  position: GeoJSON.Position; // [lng, lat]
  type: WaypointType;
  mandatory: boolean;
  trackDistance: number; // meters from route start
}

export interface GenerateOptions {
  bearingThresholdDeg?: number; // default 15
  mergeRadiusM?: number;        // default 100
  triggerRadiusM?: number;      // default 50
}

export function generateWaypoints(
  geoJson: GeoJSON.FeatureCollection,
  routeId: string,
  options: GenerateOptions = {},
): Waypoint[] {
  const { bearingThresholdDeg = 15, mergeRadiusM = 100, triggerRadiusM = 50 } = options;

  const trackFeature = geoJson.features.find(
    (f) => f.geometry.type === 'LineString',
  ) as GeoJSON.Feature<GeoJSON.LineString> | undefined;

  if (!trackFeature) return [];

  const coords = trackFeature.geometry.coordinates;
  if (coords.length < 2) return [];

  const line = turf.lineString(coords);
  const totalLengthM = turf.length(line, { units: 'meters' });

  // Accumulate track distance per coordinate index
  const trackDistances: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const seg = turf.distance(turf.point(coords[i - 1]), turf.point(coords[i]), { units: 'meters' });
    trackDistances.push(trackDistances[i - 1] + seg);
  }

  const candidates: WaypointCandidate[] = [];

  // Forced start
  candidates.push({
    position: coords[0],
    type: 'SS',
    mandatory: true,
    trackDistance: 0,
  });

  // Bearing-change detection
  for (let i = 1; i < coords.length - 1; i++) {
    const bearingIn = turf.bearing(turf.point(coords[i - 1]), turf.point(coords[i]));
    const bearingOut = turf.bearing(turf.point(coords[i]), turf.point(coords[i + 1]));
    const deflection = normalizeAngle(bearingOut - bearingIn);
    const absDeflection = Math.abs(deflection);

    if (absDeflection < bearingThresholdDeg) continue;

    const turnRight = deflection > 0;
    const type = classifyTurn(absDeflection, turnRight);

    candidates.push({
      position: coords[i],
      type,
      mandatory: false,
      trackDistance: trackDistances[i],
    });
  }

  // Forced end
  candidates.push({
    position: coords[coords.length - 1],
    type: 'SS-END',
    mandatory: true,
    trackDistance: totalLengthM,
  });

  // Extract POI Point features and snap to nearest track point
  for (const feature of geoJson.features) {
    if (feature.geometry.type !== 'Point') continue;
    const poiType = (feature.properties?.waypointType as WaypointType | undefined) ?? 'WPT';
    const snapped = turf.nearestPointOnLine(line, feature as GeoJSON.Feature<GeoJSON.Point>);
    const snappedDist = (snapped.properties.location ?? 0) * 1000; // turf returns km → convert to m
    candidates.push({
      position: snapped.geometry.coordinates,
      type: poiType,
      mandatory: MANDATORY_TYPES.has(poiType),
      trackDistance: snappedDist,
    });
  }

  // Sort by track distance
  candidates.sort((a, b) => a.trackDistance - b.trackDistance);

  // Merge candidates within mergeRadiusM
  const merged = mergeCandidates(candidates, mergeRadiusM);

  // Build final Waypoint objects
  const waypoints: Waypoint[] = [];
  for (let i = 0; i < merged.length; i++) {
    const c = merged[i];
    const prev = merged[i - 1];
    const distFromPrev =
      i === 0
        ? 0
        : turf.distance(turf.point(prev.position), turf.point(c.position), { units: 'kilometers' });

    waypoints.push({
      id: `${routeId}-wp-${i}`,
      routeId,
      index: i,
      type: c.type,
      coordinates: { lat: c.position[1], lng: c.position[0] },
      distanceFromPrev: distFromPrev,
      triggerRadiusM,
      mandatory: c.mandatory || MANDATORY_TYPES.has(c.type),
    });
  }

  return waypoints;
}

function classifyTurn(absAngle: number, right: boolean): WaypointType {
  if (absAngle >= 135) return 'UT';
  if (absAngle >= 90) return right ? 'HR' : 'HL';
  if (absAngle >= 45) return right ? 'TR' : 'TL';
  return right ? 'KR' : 'KL';
}

// Normalize angle to [-180, 180]
function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

function mergeCandidates(
  sorted: WaypointCandidate[],
  mergeRadiusM: number,
): WaypointCandidate[] {
  if (sorted.length === 0) return [];

  const result: WaypointCandidate[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const last = result[result.length - 1];
    const distM = turf.distance(turf.point(last.position), turf.point(curr.position), {
      units: 'meters',
    });

    if (distM <= mergeRadiusM) {
      // Keep the higher-priority type (lower priority number wins)
      const lastPriority = WAYPOINT_PRIORITY[last.type] ?? 99;
      const currPriority = WAYPOINT_PRIORITY[curr.type] ?? 99;
      if (currPriority < lastPriority) {
        result[result.length - 1] = {
          ...curr,
          mandatory: curr.mandatory || last.mandatory,
        };
      } else {
        result[result.length - 1] = {
          ...last,
          mandatory: curr.mandatory || last.mandatory,
        };
      }
    } else {
      result.push(curr);
    }
  }

  return result;
}
