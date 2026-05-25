import { computeSegmentDistanceM, createOdometer } from '@/engine/odometer';

describe('computeSegmentDistanceM', () => {
  it('returns 0 for identical points', () => {
    expect(computeSegmentDistanceM(48.0, 16.0, 48.0, 16.0)).toBe(0);
  });

  it('returns ~111 km for 1 degree of latitude', () => {
    const m = computeSegmentDistanceM(0, 0, 1, 0);
    expect(m).toBeCloseTo(111_195, -2); // ±100 m tolerance
  });
});

describe('createOdometer', () => {
  it('starts at 0', () => {
    const odo = createOdometer();
    expect(odo.getKm()).toBe(0);
  });

  it('returns 0 after a single update (no previous position to diff against)', () => {
    const odo = createOdometer();
    odo.update(48.0, 16.0);
    expect(odo.getKm()).toBe(0);
  });

  it('accumulates distance across updates', () => {
    const odo = createOdometer();
    odo.update(0, 0);
    odo.update(0, 0.001); // ~111 m east
    odo.update(0, 0.002); // another ~111 m
    expect(odo.getKm()).toBeGreaterThan(0.2);
    expect(odo.getKm()).toBeLessThan(0.25);
  });

  it('reset clears accumulated distance and previous position', () => {
    const odo = createOdometer();
    odo.update(0, 0);
    odo.update(1, 0);
    expect(odo.getKm()).toBeGreaterThan(0);

    odo.reset();
    expect(odo.getKm()).toBe(0);

    // After reset, first update should not accumulate (no prev position)
    odo.update(1, 0);
    expect(odo.getKm()).toBe(0);
  });

  it('produces correct total for a known two-segment path', () => {
    // Each segment is ~1 degree latitude ≈ 111.195 km
    const odo = createOdometer();
    odo.update(0, 0);
    odo.update(1, 0);
    odo.update(2, 0);
    expect(odo.getKm()).toBeCloseTo(222.39, 0); // ±0.5 km
  });
});
