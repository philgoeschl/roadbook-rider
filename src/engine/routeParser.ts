import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { XMLParser } from 'fast-xml-parser';
import type { WaypointType } from '@/types';

async function readFileAsString(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.text();
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

// Exported for unit testing
export function parseGpxString(xml: string): { geoJson: GeoJSON.FeatureCollection; name: string } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);
  const gpx = doc?.gpx;
  if (!gpx) throw new Error('Invalid GPX: missing <gpx> root');

  const name: string = gpx.metadata?.name ?? gpx.trk?.name ?? 'Imported Route';
  const features: GeoJSON.Feature[] = [];

  // Parse track(s) — can be a single object or array
  const tracks = Array.isArray(gpx.trk) ? gpx.trk : gpx.trk ? [gpx.trk] : [];
  for (const trk of tracks) {
    const segs = Array.isArray(trk.trkseg) ? trk.trkseg : trk.trkseg ? [trk.trkseg] : [];
    const coords: GeoJSON.Position[] = [];
    for (const seg of segs) {
      const pts = Array.isArray(seg.trkpt) ? seg.trkpt : seg.trkpt ? [seg.trkpt] : [];
      for (const pt of pts) {
        const lat = parseFloat(pt['@_lat']);
        const lon = parseFloat(pt['@_lon']);
        if (!isNaN(lat) && !isNaN(lon)) coords.push([lon, lat]);
      }
    }
    if (coords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { name: trk.name ?? name, type: 'track' },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
  }

  // Parse waypoints <wpt>
  const wpts = Array.isArray(gpx.wpt) ? gpx.wpt : gpx.wpt ? [gpx.wpt] : [];
  for (const wpt of wpts) {
    const lat = parseFloat(wpt['@_lat']);
    const lon = parseFloat(wpt['@_lon']);
    if (isNaN(lat) || isNaN(lon)) continue;
    const wptName: string = wpt.name ?? '';
    features.push({
      type: 'Feature',
      properties: {
        name: wptName,
        type: 'poi',
        waypointType: mapGpxSymbolToWaypointType(wpt.sym ?? wptName),
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  }

  if (features.length === 0) throw new Error('GPX contains no track or waypoint data');
  return { geoJson: { type: 'FeatureCollection', features }, name };
}

// Exported for unit testing
export function parseKmlString(xml: string): { geoJson: GeoJSON.FeatureCollection; name: string } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);
  const kml = doc?.kml;
  if (!kml) throw new Error('Invalid KML: missing <kml> root');

  const docNode = kml.Document ?? kml;
  const name: string = docNode.name ?? 'Imported Route';
  const features: GeoJSON.Feature[] = [];

  const placemarks = collectPlacemarks(docNode);
  for (const pm of placemarks) {
    const pmName: string = typeof pm.name === 'string' ? pm.name : '';
    const lineString = pm.LineString as { coordinates?: string } | undefined;
    const point = pm.Point as { coordinates?: string } | undefined;

    if (lineString) {
      const coords = parseKmlCoords(lineString.coordinates ?? '');
      if (coords.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { name: pmName, type: 'track' },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    } else if (point) {
      const coords = parseKmlCoords(point.coordinates ?? '');
      if (coords.length >= 1) {
        features.push({
          type: 'Feature',
          properties: { name: pmName, type: 'poi', waypointType: mapNameToWaypointType(pmName) },
          geometry: { type: 'Point', coordinates: coords[0] },
        });
      }
    }
  }

  if (features.length === 0) throw new Error('KML contains no LineString or Point data');
  return { geoJson: { type: 'FeatureCollection', features }, name };
}

export async function parseRouteFile(
  uri: string,
  fileName: string,
): Promise<{ geoJson: GeoJSON.FeatureCollection; name: string }> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const content = await readFileAsString(uri);

  if (ext === 'gpx') return parseGpxString(content);
  if (ext === 'kml') return parseKmlString(content);
  if (ext === 'geojson' || ext === 'json') return parseGeoJsonString(content, fileName);

  // Fallback: sniff content
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseGeoJsonString(content, fileName);
  if (trimmed.includes('<gpx')) return parseGpxString(content);
  if (trimmed.includes('<kml')) return parseKmlString(content);

  throw new Error(`Unsupported file format: ${fileName}`);
}

function parseGeoJsonString(
  content: string,
  fileName: string,
): { geoJson: GeoJSON.FeatureCollection; name: string } {
  const parsed = JSON.parse(content) as GeoJSON.GeoJSON;
  if (parsed.type === 'FeatureCollection') {
    return { geoJson: parsed, name: extractNameFromFileName(fileName) };
  }
  if (parsed.type === 'Feature') {
    return {
      geoJson: { type: 'FeatureCollection', features: [parsed] },
      name: (parsed as GeoJSON.Feature).properties?.name ?? extractNameFromFileName(fileName),
    };
  }
  if (parsed.type === 'LineString' || parsed.type === 'MultiLineString') {
    return {
      geoJson: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { type: 'track' }, geometry: parsed }],
      },
      name: extractNameFromFileName(fileName),
    };
  }
  throw new Error('GeoJSON must be a FeatureCollection, Feature, LineString, or MultiLineString');
}

function extractNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
}

// KML coordinate strings are "lng,lat,alt lng,lat,alt ..." (longitude first)
function parseKmlCoords(raw: string): GeoJSON.Position[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((triplet) => {
      const parts = triplet.split(',');
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (isNaN(lng) || isNaN(lat)) return null;
      return [lng, lat] as GeoJSON.Position;
    })
    .filter((p): p is GeoJSON.Position => p !== null);
}

function collectPlacemarks(node: Record<string, unknown>): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  if (!node || typeof node !== 'object') return results;

  if ('LineString' in node || 'Point' in node) {
    results.push(node);
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (key === 'Placemark') {
      const pms = Array.isArray(child) ? child : [child];
      results.push(...pms.map((p) => p as Record<string, unknown>));
    } else if (key === 'Folder' || key === 'Document') {
      const folders = Array.isArray(child) ? child : [child];
      for (const folder of folders) {
        results.push(...collectPlacemarks(folder as Record<string, unknown>));
      }
    }
  }
  return results;
}

const GPX_SYMBOL_MAP: Record<string, WaypointType> = {
  fuel: 'FUEL',
  'fuel station': 'FUEL',
  camp: 'CAMP',
  camping: 'CAMP',
  medical: 'MED',
  service: 'SRV',
  checkpoint: 'CP',
  cp: 'CP',
  timing: 'TC',
  tc: 'TC',
  photo: 'PHOTO',
  caution: 'CAU-CROSS',
  waypoint: 'WPT',
  start: 'SS',
  finish: 'SS-END',
  end: 'SS-END',
};

function mapGpxSymbolToWaypointType(sym: string): WaypointType {
  return GPX_SYMBOL_MAP[sym.toLowerCase()] ?? 'WPT';
}

function mapNameToWaypointType(name: string): WaypointType {
  return mapGpxSymbolToWaypointType(name);
}
