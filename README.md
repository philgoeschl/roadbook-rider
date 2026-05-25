# roadbook-rider

A React Native (Expo) app that turns any GPS route into a rally-raid-style navigation experience. Instead of turn-by-turn voice guidance, riders follow a sequence of visual waypoint cards — just like a Dakar stage. Miss a mandatory checkpoint, earn a penalty.

> **Status:** Early development — see `docs/ROADBOOK_RIDER_plan.md` for the full design spec.

## Concept

Import a GPX/KML/GeoJSON route (or paste coordinates) and the app automatically generates waypoint cards from the route geometry: turns, forks, hazards, checkpoints. During a ride the screen shows one large, glove-friendly card at a time. GPS proximity detection auto-advances to the next waypoint and flags missed ones.

## Tech Stack

- **Expo + React Native** — cross-platform mobile (iOS, Android, Web)
- **Expo Router** — file-based screen routing
- **Mapbox GL** — map rendering + offline tile packs
- **expo-location** — foreground & background GPS tracking
- **Turf.js** — geospatial analysis (bearing, distance, fork detection)
- **expo-sqlite** — local storage for routes and sessions
- **Zustand** — lightweight state management
- **TypeScript** — strict mode

## Getting Started

### Prerequisites

- Node.js 18+
- Expo Go on device, or iOS Simulator (Xcode) / Android Emulator (Android Studio)
- A [Mapbox access token](https://www.mapbox.com/) (free tier available)

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

Edit `.env` and set your Mapbox token:

```
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
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
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Mapbox GL access token — required for map tiles |

After editing `.env`, restart the dev server.

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
app/                      # Expo Router screens
  (tabs)/                 # Tab nav: Home, My Routes, Settings
  ride/[sessionId].tsx    # Active ride — full-screen waypoint card
  route/[routeId].tsx     # Route preview & waypoint editor
src/
  engine/                 # Pure logic, no UI dependencies
    routeParser.ts        # GPX / KML / GeoJSON → Route
    waypointGen.ts        # Auto-generates waypoints from geometry
    proximity.ts          # GPS proximity → PASSED / MISSED events
    odometer.ts           # Trip computer
  components/
    WaypointCard/         # Full-screen high-contrast card
    WaypointSymbol/       # SVG icon per waypoint type
    RoadbookScroll/       # Vertical tape-style waypoint list
    MiniMap/              # Contextual map overlay
  store/
    routeStore.ts         # Zustand: loaded routes, active route
    sessionStore.ts       # Zustand: active session, events, penalties
  db/
    schema.ts             # SQLite schema
  types/
    index.ts              # Route, Waypoint, Session interfaces
assets/
  waypoint-symbols/       # SVG icons for each WaypointType code
```

## Waypoint Types

| Category | Codes |
|----------|-------|
| Navigation | `GO KR KL TR TL HR HL UT RB FRK` |
| Hazard | `CAU-CROSS CAU-ROCK CAU-TRACK CAU-PASS CAU-SLICK CAU-BUMP CAU-ROAD CAU-TRAFFIC` |
| Special | `CP TC FUEL PARK CAMP SRV MED WPT SS SS-END PHOTO INFO` |
| Bearing | `HDG DST` |

## Roadmap

- **Phase 1 (MVP):** Route import, auto waypoint generation, manual editor, live GPS + proximity detection, session log
- **Phase 2:** Roadbook scroll view, odometer, stage timing, penalty system, PDF export, route sharing
- **Phase 3:** Community waypoint packs, photo evidence at checkpoints, wearable companion (Watch/WearOS), Bluetooth handlebar display

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2025 Philipp Goeschl.
