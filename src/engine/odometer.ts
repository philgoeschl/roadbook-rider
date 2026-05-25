import * as turf from '@turf/turf';

export function computeSegmentDistanceM(
  prevLat: number,
  prevLng: number,
  currLat: number,
  currLng: number,
): number {
  return turf.distance(
    turf.point([prevLng, prevLat]),
    turf.point([currLng, currLat]),
    { units: 'meters' },
  );
}
