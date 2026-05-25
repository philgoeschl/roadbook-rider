# RoadbookRider 🏍️
### *Turn every ride into a rally raid*

> **GitHub Repo:** `roadbook-rider`

---

## Concept

RoadbookRider transforms a standard GPS route into a rally-raid-style navigation experience. Instead of turn-by-turn voice guidance, the rider follows a sequence of visual waypoint cards — just like a real Dakar stage. Miss one, earn a penalty. Nail them all, own the road.

---

## Waypoint Types

### 🔴 Navigation Waypoints
| Icon | Code | Name | Description |
|------|------|------|-------------|
| ↑ | `GO` | Go Straight | Continue straight ahead |
| ↗ | `KR` | Keep Right | Bear right without a full turn |
| ↖ | `KL` | Keep Left | Bear left without a full turn |
| ➡ | `TR` | Turn Right | Standard right turn |
| ⬅ | `TL` | Turn Left | Standard left turn |
| ↩ | `HR` | Hard Right | Sharp / hairpin right |
| ↪ | `HL` | Hard Left | Sharp / hairpin left |
| 🔄 | `UT` | U-Turn | 180° turn |
| ⭕ | `RB` | Roundabout | Enter roundabout, with exit number |
| 🔀 | `FRK` | Fork | Road splits — specify which branch |

### ⚠️ Hazard & Caution Waypoints
| Icon | Code | Name | Description |
|------|------|------|-------------|
| 🌊 | `CAU-CROSS` | Water Crossing | River, stream, or ford ahead |
| 🪨 | `CAU-ROCK` | Rocky Terrain | Loose rocks or technical surface |
| 🌿 | `CAU-TRACK` | Track Narrows | Road becomes single-track |
| 🏔️ | `CAU-PASS` | Mountain Pass | Steep ascent / descent |
| 🌧️ | `CAU-SLICK` | Slippery Surface | Mud, gravel, wet road |
| ⚡ | `CAU-BUMP` | Speed Bump / Dip | Ditch, whoop, or road dip |
| 🚧 | `CAU-ROAD` | Road Works | Construction zone |
| 🚗 | `CAU-TRAFFIC` | Traffic Zone | Populated area, reduce speed |

### 📍 Special Waypoints
| Icon | Code | Name | Description |
|------|------|------|-------------|
| 🏁 | `CP` | Checkpoint | Mandatory passage point — must be confirmed |
| ⏱️ | `TC` | Time Control | Timed section begins / ends here |
| ⛽ | `FUEL` | Fuel Stop | Refueling point |
| 🅿️ | `PARK` | Parking / Rest | Designated stop area |
| 🏕️ | `CAMP` | Bivouac | Camp / overnight stop |
| 🔧 | `SRV` | Service Point | Mechanical assistance available |
| 🚑 | `MED` | Medical Post | First aid / medical station |
| 📡 | `WPT` | GPS Waypoint | Coordinate verification point |
| 🚩 | `SS` | Special Stage Start | Timed stage begins |
| 🏴 | `SS-END` | Special Stage End | Timed stage ends |
| 📸 | `PHOTO` | Photo Point | Scenic or documentation stop |
| ℹ️ | `INFO` | Info Point | Route note, sign, or landmark to identify |

### 🧭 Bearing / Distance Waypoints
| Icon | Code | Name | Description |
|------|------|------|-------------|
| 🧭 | `HDG` | Heading | Follow compass bearing (°) for distance (km) |
| 📏 | `DST` | Distance Marker | Track odometer reset or distance note |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo) |
| Navigation | React Navigation v6 |
| Maps | react-native-maps + Mapbox GL |
| GPS | expo-location |
| Storage | SQLite (via expo-sqlite) |
| Route Parsing | Turf.js (geospatial analysis) |
| State Management | Zustand |
| File Import | GPX / KML / GeoJSON support |
| Offline Maps | Mapbox offline tile packs |
| UI Icons | Custom SVG waypoint symbols |

---

## Core Features

### Phase 1 — MVP
- [ ] Import a route (GPX/KML/GeoJSON file or paste coordinates)
- [ ] Automatic waypoint generation from route analysis
  - Detects turns, forks, and bearing changes above threshold angle
  - Assigns waypoint type based on geometry
- [ ] Manual waypoint editor (add, remove, retype)
- [ ] Waypoint card display (full-screen, high-contrast, glove-friendly)
- [ ] Live GPS tracking with proximity detection
  - Auto-advance to next waypoint when within radius (configurable, default 50m)
  - Mark waypoint as MISSED if rider passes without triggering
- [ ] Session log (passed / missed / skipped per waypoint)
- [ ] Distance to next waypoint (meters / km)
- [ ] Current heading & bearing to next waypoint

### Phase 2 — Rally Features
- [ ] Roadbook scroll view (vertical tape-style, like physical roadbooks)
- [ ] Odometer / trip computer (auto-calibrated via GPS)
- [ ] Time controls & stage timing
- [ ] Penalty system for missed checkpoints
- [ ] Export session results as PDF roadbook
- [ ] Route sharing between riders (same stage, compare results)

### Phase 3 — Community & Polish
- [ ] Community waypoint packs (user-submitted routes)
- [ ] Route difficulty rating
- [ ] Waypoint photo evidence (snap photo at checkpoint)
- [ ] Offline-first: full functionality without data connection
- [ ] Apple Watch / WearOS companion (glanceable next waypoint)
- [ ] Bluetooth device support (handlebar display)

---

## Data Model

```typescript
// Route
interface Route {
  id: string;
  name: string;
  description?: string;
  totalDistanceKm: number;
  createdAt: Date;
  waypoints: Waypoint[];
  geoJson: GeoJSON.FeatureCollection;
}

// Waypoint
interface Waypoint {
  id: string;
  routeId: string;
  index: number;             // order in the route
  type: WaypointType;        // GO | TL | TR | CP | FUEL | etc.
  coordinates: {
    lat: number;
    lng: number;
  };
  bearing?: number;          // compass heading at this point
  distanceFromPrev: number;  // km
  note?: string;             // free text note
  triggerRadiusM: number;    // default 50m
  mandatory: boolean;        // if true, missing = penalty
}

// Session (one ride attempt)
interface Session {
  id: string;
  routeId: string;
  startedAt: Date;
  endedAt?: Date;
  events: SessionEvent[];
  totalDistanceKm: number;
  missedWaypoints: string[]; // waypoint IDs
}

// Session Event
interface SessionEvent {
  waypointId: string;
  type: 'PASSED' | 'MISSED' | 'SKIPPED';
  timestamp: Date;
  coordinates: { lat: number; lng: number };
}
```

---

## Waypoint Auto-Generation Algorithm

```
1. Parse route polyline into ordered coordinate array
2. For every coordinate triple [prev, current, next]:
   a. Calculate bearing change (deflection angle)
   b. If |angle| > 15°  → candidate waypoint
   c. Classify:
      - 15°–45°  → Keep Left / Keep Right
      - 45°–90°  → Turn Left / Turn Right
      - 90°–135° → Hard Left / Hard Right
      - >135°    → U-Turn
3. Detect forks: find nodes where 2+ forward paths exist
4. Insert mandatory waypoints at:
   - Route start (SS or GO)
   - Route end (SS-END or CP)
   - Any tagged POI in source GPX (fuel, camp, etc.)
5. Merge waypoints closer than 100m (keep highest priority type)
6. Assign sequential index and compute inter-waypoint distances
```

---

## Screen Flow

```
Splash
  └─> Home
        ├─> Import Route (GPX / KML / manual)
        │     └─> Route Preview + Waypoint Editor
        │           └─> Start Ride
        │                 └─> Ride Screen (full-screen waypoint card)
        │                       └─> Session Summary
        ├─> My Routes (list)
        └─> Settings (trigger radius, units, sound, theme)
```

---

## Ride Screen Layout

```
┌─────────────────────────────┐
│  #7 / 34          3.2 km ➡  │  ← waypoint counter + distance
├─────────────────────────────┤
│                             │
│       [WAYPOINT SYMBOL]     │  ← large, full-contrast symbol
│         HARD RIGHT          │  ← type label
│                             │
├─────────────────────────────┤
│  ↑ N  47°   🧭  215°  2.1km │  ← current heading / bearing to WP
├─────────────────────────────┤
│  NEXT: ↑ GO  (1.8 km)       │  ← sneak peek at next waypoint
└─────────────────────────────┘
```

---

## Project Structure

```
roadbook-rider/
├── app/                    # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx       # Home
│   │   ├── routes.tsx      # My Routes
│   │   └── settings.tsx    # Settings
│   ├── ride/[sessionId].tsx # Active Ride Screen
│   └── route/[routeId].tsx  # Route Preview & Editor
├── src/
│   ├── components/
│   │   ├── WaypointCard/   # The big full-screen card
│   │   ├── WaypointSymbol/ # SVG symbol renderer
│   │   ├── RoadbookScroll/ # Tape-style scroll view
│   │   └── MiniMap/        # Small context map
│   ├── engine/
│   │   ├── routeParser.ts  # GPX/KML/GeoJSON import
│   │   ├── waypointGen.ts  # Auto-generation algorithm
│   │   ├── proximity.ts    # GPS proximity detection
│   │   └── odometer.ts     # Trip computer
│   ├── store/
│   │   ├── routeStore.ts   # Zustand route state
│   │   └── sessionStore.ts # Zustand session state
│   ├── db/
│   │   └── schema.ts       # SQLite schema
│   └── types/
│       └── index.ts        # Shared TypeScript types
├── assets/
│   └── waypoint-symbols/   # SVG icons for each type
├── app.json
├── package.json
└── README.md
```

---

## Getting Started (Dev Setup)

```bash
git clone https://github.com/YOUR_USERNAME/roadbook-rider
cd roadbook-rider
npm install
npx expo start
```

Requirements: Node 18+, Expo Go app on device, or iOS/Android emulator.

---

## Inspiration

- Dakar Rally roadbook format (Erzberg, Merzouga Rally)
- ICO odometer / roadbook reader devices
- TerraTrip rally computers
- Enduro / ISDE time cards

---

*"No voice. No arrows. Just the next sign and your instincts."*
