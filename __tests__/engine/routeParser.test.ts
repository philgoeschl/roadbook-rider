import { parseGpxString, parseKmlString } from '../../src/engine/routeParser';

describe('parseGpxString', () => {
  const GPX_3PT = `<?xml version="1.0"?>
<gpx version="1.1">
  <metadata><name>Test Route</name></metadata>
  <trk>
    <name>Track 1</name>
    <trkseg>
      <trkpt lat="47.100" lon="8.300"></trkpt>
      <trkpt lat="47.200" lon="8.400"></trkpt>
      <trkpt lat="47.300" lon="8.500"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  it('produces a FeatureCollection with a LineString', () => {
    const { geoJson } = parseGpxString(GPX_3PT);
    expect(geoJson.type).toBe('FeatureCollection');
    const line = geoJson.features.find((f) => f.geometry.type === 'LineString');
    expect(line).toBeDefined();
  });

  it('has 3 coordinates in the correct [lng, lat] order', () => {
    const { geoJson } = parseGpxString(GPX_3PT);
    const line = geoJson.features.find(
      (f) => f.geometry.type === 'LineString',
    ) as GeoJSON.Feature<GeoJSON.LineString>;
    expect(line.geometry.coordinates).toHaveLength(3);
    // GeoJSON is [lng, lat]; GPX trkpt has lat/lon attributes
    expect(line.geometry.coordinates[0]).toEqual([8.3, 47.1]);
  });

  it('extracts route name from <metadata><name>', () => {
    const { name } = parseGpxString(GPX_3PT);
    expect(name).toBe('Test Route');
  });

  const GPX_WITH_WPT = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><trkseg>
    <trkpt lat="47.1" lon="8.3"></trkpt>
    <trkpt lat="47.2" lon="8.4"></trkpt>
  </trkseg></trk>
  <wpt lat="47.15" lon="8.35"><name>Fuel Stop</name><sym>Fuel</sym></wpt>
</gpx>`;

  it('extracts <wpt> as Point features with waypointType', () => {
    const { geoJson } = parseGpxString(GPX_WITH_WPT);
    const poi = geoJson.features.find((f) => f.geometry.type === 'Point') as GeoJSON.Feature<GeoJSON.Point>;
    expect(poi).toBeDefined();
    expect(poi.properties?.waypointType).toBe('FUEL');
    // GeoJSON point is [lng, lat]
    expect(poi.geometry.coordinates[0]).toBeCloseTo(8.35);
    expect(poi.geometry.coordinates[1]).toBeCloseTo(47.15);
  });

  it('throws on invalid GPX', () => {
    expect(() => parseGpxString('<notgpx/>')).toThrow();
  });
});

describe('parseKmlString', () => {
  const KML_TRACK = `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>KML Route</name>
    <Placemark>
      <name>Track</name>
      <LineString>
        <coordinates>8.300,47.100,0 8.400,47.200,0 8.500,47.300,0</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

  it('produces a FeatureCollection with a LineString', () => {
    const { geoJson } = parseKmlString(KML_TRACK);
    const line = geoJson.features.find((f) => f.geometry.type === 'LineString');
    expect(line).toBeDefined();
  });

  it('parses KML coordinates as [lng, lat] (longitude first)', () => {
    const { geoJson } = parseKmlString(KML_TRACK);
    const line = geoJson.features.find(
      (f) => f.geometry.type === 'LineString',
    ) as GeoJSON.Feature<GeoJSON.LineString>;
    // KML: "lng,lat,alt" — first coord should be [8.3, 47.1]
    expect(line.geometry.coordinates[0][0]).toBeCloseTo(8.3);  // lng
    expect(line.geometry.coordinates[0][1]).toBeCloseTo(47.1); // lat
  });

  it('extracts document name', () => {
    const { name } = parseKmlString(KML_TRACK);
    expect(name).toBe('KML Route');
  });

  const KML_WITH_POI = `<?xml version="1.0"?>
<kml>
  <Document>
    <Placemark>
      <LineString><coordinates>8.3,47.1,0 8.4,47.2,0</coordinates></LineString>
    </Placemark>
    <Placemark>
      <name>Fuel</name>
      <Point><coordinates>8.35,47.15,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

  it('extracts Point placemarks', () => {
    const { geoJson } = parseKmlString(KML_WITH_POI);
    const poi = geoJson.features.find((f) => f.geometry.type === 'Point') as GeoJSON.Feature<GeoJSON.Point>;
    expect(poi).toBeDefined();
    expect(poi.geometry.coordinates[0]).toBeCloseTo(8.35);
    expect(poi.geometry.coordinates[1]).toBeCloseTo(47.15);
  });

  it('throws on invalid KML', () => {
    expect(() => parseKmlString('<notkml/>')).toThrow();
  });
});
