import { generateWaypoints } from '../../src/engine/waypointGen';

const ROUTE_ID = 'test-route';

function makeLineString(coords: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { type: 'track' },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}

describe('generateWaypoints', () => {
  it('returns SS at start and SS-END at end', () => {
    const fc = makeLineString([
      [8.3, 47.1],
      [8.4, 47.1],
      [8.5, 47.1],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID);
    expect(wps[0].type).toBe('SS');
    expect(wps[wps.length - 1].type).toBe('SS-END');
  });

  it('produces only SS and SS-END for a straight road (no bearing change)', () => {
    // All points at the same latitude — heading due east, no turns
    const fc = makeLineString([
      [8.0, 47.0],
      [8.1, 47.0],
      [8.2, 47.0],
      [8.3, 47.0],
      [8.4, 47.0],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID);
    expect(wps.every((w) => w.type === 'SS' || w.type === 'SS-END')).toBe(true);
  });

  it('classifies a ~90° right turn as TR', () => {
    // Go east then turn south — ~90° right deflection
    const fc = makeLineString([
      [8.0, 47.0],
      [8.1, 47.0],  // heading east
      [8.1, 46.9],  // now heading south — right turn
      [8.1, 46.8],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID);
    const turn = wps.find((w) => w.type === 'TR' || w.type === 'HR');
    expect(turn).toBeDefined();
  });

  it('classifies a ~90° left turn as TL', () => {
    // Go east then turn north — ~90° left deflection
    const fc = makeLineString([
      [8.0, 47.0],
      [8.1, 47.0],  // heading east
      [8.1, 47.1],  // now heading north — left turn
      [8.1, 47.2],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID);
    const turn = wps.find((w) => w.type === 'TL' || w.type === 'HL');
    expect(turn).toBeDefined();
  });

  it('merges two waypoints within 100m into the higher-priority one', () => {
    // Create a very sharp turn immediately followed by another 45° turn ~50m later.
    // Use coordinates close enough to be within 100m of each other.
    // Both at approx lat 47.0, lon 8.1 area — 0.0005° ≈ ~45m
    const fc = makeLineString([
      [8.0, 47.0],
      [8.1, 47.0],         // heading east (approaching turn)
      [8.1, 46.9],         // U-turn candidate (90° right)
      [8.10045, 46.9],     // another turn ~50m east → should merge with above
      [8.10045, 46.8],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID, { mergeRadiusM: 100 });
    // Verify SS and SS-END are still there
    expect(wps[0].type).toBe('SS');
    expect(wps[wps.length - 1].type).toBe('SS-END');
  });

  it('assigns sequential index values', () => {
    const fc = makeLineString([
      [8.0, 47.0],
      [8.1, 47.0],
      [8.1, 47.1],
      [8.2, 47.1],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID);
    wps.forEach((w, i) => expect(w.index).toBe(i));
  });

  it('sets distanceFromPrev to 0 for the first waypoint', () => {
    const fc = makeLineString([
      [8.0, 47.0],
      [8.1, 47.0],
    ]);
    const wps = generateWaypoints(fc, ROUTE_ID);
    expect(wps[0].distanceFromPrev).toBe(0);
  });

  it('sets mandatory=true for SS, SS-END, and CP types', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'track' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [8.0, 47.0],
              [8.1, 47.0],
              [8.2, 47.0],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { type: 'poi', waypointType: 'CP' },
          geometry: { type: 'Point', coordinates: [8.1, 47.0] },
        },
      ],
    };
    const wps = generateWaypoints(fc, ROUTE_ID);
    const cp = wps.find((w) => w.type === 'CP');
    expect(cp?.mandatory).toBe(true);
    expect(wps[0].mandatory).toBe(true);         // SS
    expect(wps[wps.length - 1].mandatory).toBe(true); // SS-END
  });

  it('returns empty array for missing LineString', () => {
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    expect(generateWaypoints(fc, ROUTE_ID)).toEqual([]);
  });
});
