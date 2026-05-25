// Navigation waypoint types
export type NavigationWaypointType =
  | 'GO'   // Go straight
  | 'KR'   // Keep right (15–45°)
  | 'KL'   // Keep left (15–45°)
  | 'TR'   // Turn right (45–90°)
  | 'TL'   // Turn left (45–90°)
  | 'HR'   // Hard right (90–135°)
  | 'HL'   // Hard left (90–135°)
  | 'UT'   // U-turn (>135°)
  | 'RB'   // Roundabout
  | 'FRK'; // Fork

// Hazard waypoint types
export type HazardWaypointType =
  | 'CAU-CROSS'
  | 'CAU-ROCK'
  | 'CAU-TRACK'
  | 'CAU-PASS'
  | 'CAU-SLICK'
  | 'CAU-BUMP'
  | 'CAU-ROAD'
  | 'CAU-TRAFFIC';

// Special waypoint types
export type SpecialWaypointType =
  | 'CP'      // Checkpoint (mandatory)
  | 'TC'      // Time control (mandatory)
  | 'FUEL'
  | 'PARK'
  | 'CAMP'
  | 'SRV'     // Service
  | 'MED'     // Medical
  | 'WPT'     // Generic waypoint
  | 'SS'      // Stage start (mandatory)
  | 'SS-END'  // Stage end (mandatory)
  | 'PHOTO'
  | 'INFO';

// Bearing reference types
export type BearingWaypointType = 'HDG' | 'DST';

export type WaypointType =
  | NavigationWaypointType
  | HazardWaypointType
  | SpecialWaypointType
  | BearingWaypointType;

export type SessionEventType = 'PASSED' | 'MISSED' | 'SKIPPED';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  totalDistanceKm: number;
  waypoints: Waypoint[];
  geoJson: GeoJSON.FeatureCollection;
  createdAt: number; // Unix ms
}

export interface Waypoint {
  id: string;
  routeId: string;
  index: number;
  type: WaypointType;
  coordinates: Coordinates;
  bearing?: number;
  distanceFromPrev: number; // km
  triggerRadiusM: number;   // default 50
  mandatory: boolean;
  note?: string;
}

export interface SessionEvent {
  id: string;
  waypointId: string;
  type: SessionEventType;
  timestamp: number; // Unix ms
  coordinates: Coordinates;
}

export interface Session {
  id: string;
  routeId: string;
  startedAt: number; // Unix ms
  endedAt?: number;  // Unix ms
  events: SessionEvent[];
  missedWaypoints: string[]; // waypoint IDs
  totalDistanceKm: number;
}

export interface AppSettings {
  triggerRadiusM: number;
  distanceUnit: 'km' | 'mi';
  theme: 'light' | 'dark' | 'auto' | 'sunlight';
  penaltyPerMissMs: number; // time penalty per missed mandatory waypoint, in ms
}
