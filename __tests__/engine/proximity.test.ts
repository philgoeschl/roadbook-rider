import {
  checkProximity,
  getBearingToWaypoint,
  getDistanceToWaypointM,
} from '../../src/engine/proximity';

describe('checkProximity', () => {
  const wpLat = 47.0;
  const wpLng = 8.0;

  it('returns true when user is exactly at the waypoint', () => {
    expect(checkProximity(wpLat, wpLng, wpLat, wpLng, 50)).toBe(true);
  });

  it('returns true when user is within the radius (49m away)', () => {
    // 0.00044° latitude ≈ 49m
    expect(checkProximity(47.00044, 8.0, wpLat, wpLng, 50)).toBe(true);
  });

  it('returns false when user is outside the radius (51m away)', () => {
    // 0.00046° latitude ≈ 51m
    expect(checkProximity(47.00046, 8.0, wpLat, wpLng, 50)).toBe(false);
  });

  it('uses the provided radius', () => {
    // ~111m away (0.001° lat)
    expect(checkProximity(47.001, 8.0, wpLat, wpLng, 50)).toBe(false);
    expect(checkProximity(47.001, 8.0, wpLat, wpLng, 200)).toBe(true);
  });
});

describe('getBearingToWaypoint', () => {
  it('returns ~0 for a due-north target', () => {
    const bearing = getBearingToWaypoint(47.0, 8.0, 47.1, 8.0);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('returns ~90 for a due-east target', () => {
    const bearing = getBearingToWaypoint(47.0, 8.0, 47.0, 8.1);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('returns ~180 for a due-south target', () => {
    const bearing = getBearingToWaypoint(47.0, 8.0, 46.9, 8.0);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('returns ~270 for a due-west target', () => {
    const bearing = getBearingToWaypoint(47.0, 8.0, 47.0, 7.9);
    expect(bearing).toBeCloseTo(270, 0);
  });

  it('returns a value in [0, 360)', () => {
    const bearing = getBearingToWaypoint(47.0, 8.0, 47.1, 8.0);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe('getDistanceToWaypointM', () => {
  it('returns 0 for the same point', () => {
    expect(getDistanceToWaypointM(47.0, 8.0, 47.0, 8.0)).toBeCloseTo(0, 0);
  });

  it('returns ~111km per degree of latitude', () => {
    const dist = getDistanceToWaypointM(47.0, 8.0, 48.0, 8.0);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });
});
