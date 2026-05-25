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

export interface Odometer {
  update: (lat: number, lng: number) => void;
  getKm: () => number;
  reset: () => void;
}

export function createOdometer(): Odometer {
  let totalM = 0;
  let prevLat: number | null = null;
  let prevLng: number | null = null;

  return {
    update(lat: number, lng: number) {
      if (prevLat !== null && prevLng !== null) {
        totalM += computeSegmentDistanceM(prevLat, prevLng, lat, lng);
      }
      prevLat = lat;
      prevLng = lng;
    },
    getKm() {
      return totalM / 1000;
    },
    reset() {
      totalM = 0;
      prevLat = null;
      prevLng = null;
    },
  };
}
