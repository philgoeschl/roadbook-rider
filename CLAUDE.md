# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RoadbookRider is a React Native (Expo) app that converts GPS routes into rally-raid-style navigation. Riders follow visual waypoint cards instead of voice guidance — miss a checkpoint, earn a penalty.

Full design spec: `docs/ROADBOOK_RIDER_plan.md`

## Dev Commands

```bash
npm install              # install dependencies
npm start                # dev server — choose platform from menu (i/a/w)
npm run ios              # iOS simulator/device
npm run android          # Android emulator/device
npm run web              # web browser
npm run build:apk        # local release APK → apk/roadbook-rider-release.apk
npm run lint             # lint
npm run lint:fix         # lint + prettier fix
npm test                 # run unit tests
npm test -- --watch      # watch mode
npm test -- __tests__/foo.test.ts  # single test file
```

**APK install:** `adb install apk/roadbook-rider-release.apk` (requires Java JDK + `ANDROID_HOME` set)

## Environment Variables

Copy `.env.example` to `.env` before first run:

```bash
cp .env.example .env
```

`.env` is gitignored — never commit it. `.env.example` documents all variables and must be kept up to date.

All runtime-accessible variables use the `EXPO_PUBLIC_` prefix (available at build time in JS bundle). Variables without this prefix are build-time only and not accessible in app code.

Expected variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Mapbox GL access token (required for maps) | — |

Mapbox requires a valid token for map tile rendering and offline packs. Get one at [mapbox.com](https://www.mapbox.com/).

## Builds

### Local Android APK

Requires Java JDK and `ANDROID_HOME` pointing to the Android SDK.

```bash
npm run build:apk
# → apk/roadbook-rider-release.apk
adb install apk/roadbook-rider-release.apk
```

Output goes to `apk/` which is gitignored.

### EAS Cloud Builds

```bash
eas build --platform android --profile development   # dev client APK
eas build --platform ios     --profile development
eas build --platform android --profile preview        # internal test APK
eas build --platform android --profile production
eas build --platform ios     --profile production
```

Profiles are defined in `eas.json`:
- **development** — `expo-dev-client`, internal distribution, APK for Android
- **preview** — internal distribution, APK for Android
- **production** — auto-increment version, store-ready

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo) with Expo Router |
| Navigation | React Navigation v6 |
| Maps | react-native-maps + Mapbox GL |
| GPS | expo-location |
| Storage | SQLite via expo-sqlite |
| Geospatial | Turf.js |
| State | Zustand (routeStore, sessionStore) |
| File Import | GPX / KML / GeoJSON |
| Offline Maps | Mapbox offline tile packs |

## Architecture

### Directory Layout

```
app/                    # Expo Router screens (file-based routing)
  (tabs)/               # Tab navigator: Home, My Routes, Settings
  ride/[sessionId].tsx  # Active ride screen (full-screen waypoint card)
  route/[routeId].tsx   # Route preview & waypoint editor
src/
  engine/               # Pure logic, no UI
    routeParser.ts      # GPX/KML/GeoJSON → internal Route type
    waypointGen.ts      # Auto-generates waypoints from route geometry
    proximity.ts        # GPS proximity detection (triggers waypoint pass/miss)
    odometer.ts         # Trip computer / odometer
  components/
    WaypointCard/       # Full-screen high-contrast waypoint card (primary UI)
    WaypointSymbol/     # SVG renderer for each waypoint type
    RoadbookScroll/     # Vertical tape-style waypoint list
    MiniMap/            # Small contextual map overlay
  store/
    routeStore.ts       # Zustand: loaded routes, active route
    sessionStore.ts     # Zustand: active session, events, missed waypoints
  db/
    schema.ts           # SQLite schema for routes and sessions
  types/
    index.ts            # Shared TypeScript interfaces (Route, Waypoint, Session)
assets/
  waypoint-symbols/     # SVG icons for each WaypointType code
```

### Core Data Model

```typescript
interface Route {
  id: string;
  name: string;
  totalDistanceKm: number;
  waypoints: Waypoint[];
  geoJson: GeoJSON.FeatureCollection;
}

interface Waypoint {
  id: string;
  routeId: string;
  index: number;
  type: WaypointType;       // e.g. 'TR' | 'TL' | 'CP' | 'FUEL' | …
  coordinates: { lat: number; lng: number };
  bearing?: number;
  distanceFromPrev: number; // km
  triggerRadiusM: number;   // default 50
  mandatory: boolean;
}

interface Session {
  id: string;
  routeId: string;
  startedAt: Date;
  events: SessionEvent[];   // PASSED | MISSED | SKIPPED per waypoint
  missedWaypoints: string[];
}
```

### Waypoint Type Codes

Navigation: `GO KR KL TR TL HR HL UT RB FRK`
Hazard: `CAU-CROSS CAU-ROCK CAU-TRACK CAU-PASS CAU-SLICK CAU-BUMP CAU-ROAD CAU-TRAFFIC`
Special: `CP TC FUEL PARK CAMP SRV MED WPT SS SS-END PHOTO INFO`
Bearing: `HDG DST`

### Auto-Generation Algorithm (`src/engine/waypointGen.ts`)

For every coordinate triple `[prev, current, next]`:
1. Calculate bearing change (deflection angle)
2. If `|angle| > 15°` → candidate waypoint
3. Classify: 15–45° = Keep, 45–90° = Turn, 90–135° = Hard, >135° = U-Turn
4. Detect forks where 2+ forward paths exist
5. Insert mandatory waypoints at route start/end and tagged POIs from source file
6. Merge waypoints closer than 100m (keep highest-priority type)
7. Assign sequential index and compute inter-waypoint distances

### Ride Screen Layout

The ride screen (`app/ride/[sessionId].tsx`) is a full-screen, glove-friendly card:

```
┌─────────────────────────────┐
│  #7 / 34          3.2 km ➡  │  ← waypoint counter + distance
├─────────────────────────────┤
│       [WAYPOINT SYMBOL]     │
│         HARD RIGHT          │
├─────────────────────────────┤
│  ↑ N  47°   🧭  215°  2.1km │  ← current heading / bearing to WP
├─────────────────────────────┤
│  NEXT: ↑ GO  (1.8 km)       │
└─────────────────────────────┘
```

### Screen Flow

```
Splash → Home
  ├─ Import Route → Route Preview + Waypoint Editor → Start Ride → Ride Screen → Session Summary
  ├─ My Routes
  └─ Settings (trigger radius, units, sound, theme)
```

## Implementation Phases

- **Phase 1 (MVP):** Route import, auto waypoint generation, manual editor, live GPS with proximity detection, session log
- **Phase 2:** Roadbook scroll view, odometer, stage timing, penalty system, PDF export
- **Phase 3:** Community routes, photo evidence, offline-first, wearable companion
