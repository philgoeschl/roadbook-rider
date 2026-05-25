# roadbook-rider

A React Native (Expo) app that turns any GPS route into a rally-raid-style navigation experience. Instead of turn-by-turn voice guidance, riders follow a sequence of visual waypoint cards — just like a Dakar stage. Miss a mandatory checkpoint, earn a penalty.

> **Status:** Phase 1 MVP complete — core ride flow works end-to-end. See `docs/ROADBOOK_RIDER_plan.md` for the full design spec.

## Concept

Import a GPX/KML/GeoJSON route and the app automatically generates waypoint cards from the route geometry: turns, forks, hazards, checkpoints. During a ride the screen shows one large, glove-friendly card at a time. GPS proximity detection auto-advances to the next waypoint and flags missed ones.

## Tech Stack

- **Expo 56 + React Native 0.85** — cross-platform mobile (iOS, Android, Web)
- **Expo Router** — file-based screen routing (`src/app/`)
- **expo-location** — foreground GPS tracking
- **expo-document-picker / expo-file-system** — GPX/KML/GeoJSON file import
- **fast-xml-parser** — GPX and KML parsing
- **Turf.js** — geospatial analysis (bearing, distance, fork detection)
- **expo-sqlite** — local storage for routes and sessions
- **Zustand** — lightweight state management
- **TypeScript** (strict mode)

> Mapbox GL is planned for Phase 2 map overlays but not yet integrated.

## Getting Started

### Prerequisites

- Node.js 18+
- Expo Go on device, or iOS Simulator (Xcode) / Android Emulator (Android Studio)

### Install

```bash
git clone https://github.com/philgoeschl/roadbook-rider.git
cd roadbook-rider
npm install
```

### Configure environment

```bash
cp .env.example .env
```

`.env` is gitignored. Never commit it.

### Run

```bash
npm start          # interactive menu — press i (iOS), a (Android), w (Web)
npm run ios        # iOS simulator/device directly
npm run android    # Android emulator/device directly
npm run web        # browser
```

## Environment Variables

Documented in `.env.example`. All app-accessible variables use the `EXPO_PUBLIC_` prefix.

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Mapbox GL access token (reserved for Phase 2 map integration) |

## Building

### Local Android APK

Requires Java JDK and `ANDROID_HOME` set to your Android SDK path.

```bash
npm run build:apk
# Output: apk/roadbook-rider-release.apk

adb install apk/roadbook-rider-release.apk
```

### EAS Cloud Builds

```bash
# Development client (fast native iteration)
eas build --platform android --profile development
eas build --platform ios     --profile development

# Internal preview APK
eas build --platform android --profile preview

# Store release
eas build --platform android --profile production
eas build --platform ios     --profile production
```

Profiles defined in `eas.json`: **development** (dev client, internal), **preview** (internal APK), **production** (auto-increment, store-ready).

## Project Structure

```
src/
  app/                      # Expo Router screens
    (tabs)/
      index.tsx             # Home: import button + recent routes list
      routes.tsx            # My Routes: full library with delete
      settings.tsx          # Settings: trigger radius, units, theme
    ride/[sessionId].tsx    # Active ride — full-screen waypoint card + GPS loop
    route/[routeId].tsx     # Route preview + waypoint editor
    session/[sessionId].tsx # Post-ride summary: stats, pass/miss/skip per waypoint
  components/
    WaypointCard/           # Full-screen high-contrast card (primary ride UI)
    WaypointSymbol/         # Icon + label renderer per waypoint type
  engine/                   # Pure logic, no UI dependencies
    routeParser.ts          # GPX / KML / GeoJSON → Route
    waypointGen.ts          # Auto-generates waypoints from route geometry
    proximity.ts            # GPS proximity → PASSED / MISSED / SKIPPED events
    odometer.ts             # Trip computer
  store/
    routeStore.ts           # Zustand: loaded routes, import, update, delete
    sessionStore.ts         # Zustand: active session, events, waypoint index
    settingsStore.ts        # Zustand: trigger radius, distance unit, theme
  db/
    schema.ts               # SQLite schema + repository helpers
  types/
    index.ts                # Route, Waypoint, Session, AppSettings interfaces
  constants/
    theme.ts                # Colors (light/dark), spacing
  hooks/
    useLocation.ts          # expo-location wrapper (GPS + heading + permission)
    use-theme.ts            # Active theme colors
__tests__/
  engine/
    routeParser.test.ts
    waypointGen.test.ts
    proximity.test.ts
assets/
  images/                   # App icons, splash
  waypoint-symbols/         # SVG icons for each WaypointType code
```

### Platform-Specific Files

Expo resolves `.native.tsx` for iOS/Android and `.web.tsx` for web with the base `.tsx` as fallback.

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Home | `/` | Import a route file; shows up to 5 recent routes |
| My Routes | `/routes` | Full saved-route library with swipe-to-delete |
| Settings | `/settings` | Trigger radius (25–200 m), distance unit (km/mi), light/dark/auto theme |
| Route Preview | `/route/[routeId]` | Auto-generated waypoint list; edit type, delete individual waypoints, start ride |
| Ride | `/ride/[sessionId]` | Full-screen waypoint card; live GPS proximity detection; SKIP / END RIDE controls; screen kept awake |
| Session Summary | `/session/[sessionId]` | Elapsed time, distance, pass/miss/skip totals, per-waypoint result list; Ride Again shortcut |

## Screen Flow

```
Home
  ├─ Import Route → Route Preview + Waypoint Editor → Start Ride → Ride Screen → Session Summary
  ├─ My Routes → Route Preview
  └─ Settings
```

## Waypoint Types

| Category | Codes |
|----------|-------|
| Navigation | `GO KR KL TR TL HR HL UT RB FRK` |
| Hazard | `CAU-CROSS CAU-ROCK CAU-TRACK CAU-PASS CAU-SLICK CAU-BUMP CAU-ROAD CAU-TRAFFIC` |
| Special | `CP TC FUEL PARK CAMP SRV MED WPT SS SS-END PHOTO INFO` |
| Bearing | `HDG DST` |

## Auto-Generation Algorithm (`src/engine/waypointGen.ts`)

For every coordinate triple `[prev, current, next]`:
1. Calculate bearing change (deflection angle)
2. If `|angle| > 15°` → candidate waypoint
3. Classify: 15–45° = Keep, 45–90° = Turn, 90–135° = Hard, >135° = U-Turn
4. Detect forks where 2+ forward paths exist
5. Insert mandatory waypoints at route start/end and tagged POIs from the source file
6. Merge waypoints closer than 100 m (keep highest-priority type)
7. Assign sequential index and compute inter-waypoint distances

## Ride Screen Layout

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

## Tests

```bash
npm test                              # run all unit tests
npm test -- --watch                   # watch mode
npm test -- __tests__/engine/foo.test.ts  # single file
```

Engine modules (`routeParser`, `waypointGen`, `proximity`) have Jest unit test coverage.

## Roadmap

- **Phase 1 (MVP) — done:** Route import (GPX/KML/GeoJSON), auto waypoint generation, manual editor, live GPS proximity detection, session log with pass/miss/skip summary
- **Phase 2:** Roadbook scroll view, odometer, stage timing, penalty system, Mapbox map overlay, PDF export, route sharing
- **Phase 3:** Community waypoint packs, photo evidence at checkpoints, wearable companion (Watch/WearOS), Bluetooth handlebar display

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2025 Philipp Goeschl.
