import * as turf from '@turf/turf';

export function checkProximity(
  userLat: number,
  userLng: number,
  waypointLat: number,
  waypointLng: number,
  radiusM: number,
): boolean {
  const distM = getDistanceToWaypointM(userLat, userLng, waypointLat, waypointLng);
  return distM <= radiusM;
}

export function getBearingToWaypoint(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const bearing = turf.bearing(turf.point([fromLng, fromLat]), turf.point([toLng, toLat]));
  // turf.bearing returns [-180, 180]; normalize to [0, 360]
  return (bearing + 360) % 360;
}

export function getDistanceToWaypointM(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  return turf.distance(
    turf.point([fromLng, fromLat]),
    turf.point([toLng, toLat]),
    { units: 'meters' },
  );
}
