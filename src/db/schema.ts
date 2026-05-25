import * as SQLite from 'expo-sqlite';
import type { Route, Waypoint, Session, SessionEvent } from '@/types';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('roadbook.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      total_distance_km REAL NOT NULL DEFAULT 0,
      geo_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waypoints (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      type TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      bearing REAL,
      distance_from_prev REAL NOT NULL DEFAULT 0,
      trigger_radius_m REAL NOT NULL DEFAULT 50,
      mandatory INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_waypoints_route ON waypoints(route_id, idx);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL REFERENCES routes(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      total_distance_km REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      waypoint_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      ts INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
  `);
}

// ─── Route repo ────────────────────────────────────────────────────────────────

export const routeRepo = {
  async insertRoute(route: Route): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO routes (id, name, description, total_distance_km, geo_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        route.id,
        route.name,
        route.description ?? null,
        route.totalDistanceKm,
        JSON.stringify(route.geoJson),
        route.createdAt,
      ],
    );
    for (const wp of route.waypoints) {
      await waypointRepo.insertWaypoint(db, wp);
    }
  },

  async getAllRoutes(): Promise<Route[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<RouteRow>('SELECT * FROM routes ORDER BY created_at DESC');
    const routes: Route[] = [];
    for (const row of rows) {
      const waypoints = await waypointRepo.getWaypointsForRoute(db, row.id);
      routes.push(rowToRoute(row, waypoints));
    }
    return routes;
  },

  async getRoute(id: string): Promise<Route | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<RouteRow>('SELECT * FROM routes WHERE id = ?', [id]);
    if (!row) return null;
    const waypoints = await waypointRepo.getWaypointsForRoute(db, id);
    return rowToRoute(row, waypoints);
  },

  async deleteRoute(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM routes WHERE id = ?', [id]);
  },

  async updateWaypoints(routeId: string, waypoints: Waypoint[]): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM waypoints WHERE route_id = ?', [routeId]);
    for (const wp of waypoints) {
      await waypointRepo.insertWaypoint(db, wp);
    }
    // Recompute total distance
    const totalKm = waypoints.reduce((acc, wp) => acc + wp.distanceFromPrev, 0);
    await db.runAsync('UPDATE routes SET total_distance_km = ? WHERE id = ?', [totalKm, routeId]);
  },
};

// ─── Waypoint repo (internal, used by routeRepo) ───────────────────────────────

const waypointRepo = {
  async insertWaypoint(db: SQLite.SQLiteDatabase, wp: Waypoint): Promise<void> {
    await db.runAsync(
      `INSERT INTO waypoints
         (id, route_id, idx, type, lat, lng, bearing, distance_from_prev, trigger_radius_m, mandatory, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wp.id,
        wp.routeId,
        wp.index,
        wp.type,
        wp.coordinates.lat,
        wp.coordinates.lng,
        wp.bearing ?? null,
        wp.distanceFromPrev,
        wp.triggerRadiusM,
        wp.mandatory ? 1 : 0,
        wp.note ?? null,
      ],
    );
  },

  async getWaypointsForRoute(db: SQLite.SQLiteDatabase, routeId: string): Promise<Waypoint[]> {
    const rows = await db.getAllAsync<WaypointRow>(
      'SELECT * FROM waypoints WHERE route_id = ? ORDER BY idx ASC',
      [routeId],
    );
    return rows.map(rowToWaypoint);
  },
};

// ─── Session repo ──────────────────────────────────────────────────────────────

export const sessionRepo = {
  async insertSession(session: Session): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO sessions (id, route_id, started_at, ended_at, total_distance_km)
       VALUES (?, ?, ?, ?, ?)`,
      [session.id, session.routeId, session.startedAt, session.endedAt ?? null, session.totalDistanceKm],
    );
  },

  async updateSession(session: Session): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'UPDATE sessions SET ended_at = ?, total_distance_km = ? WHERE id = ?',
      [session.endedAt ?? null, session.totalDistanceKm, session.id],
    );
  },

  async getSession(id: string): Promise<Session | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!row) return null;
    const events = await sessionRepo.getEventsForSession(id);
    return rowToSession(row, events);
  },

  async insertEvent(sessionId: string, event: SessionEvent): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO session_events (id, session_id, waypoint_id, event_type, ts, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        sessionId,
        event.waypointId,
        event.type,
        event.timestamp,
        event.coordinates.lat,
        event.coordinates.lng,
      ],
    );
  },

  async getEventsForSession(sessionId: string): Promise<SessionEvent[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<EventRow>(
      'SELECT * FROM session_events WHERE session_id = ? ORDER BY ts ASC',
      [sessionId],
    );
    return rows.map(rowToEvent);
  },

  async getSessionsForRoute(routeId: string): Promise<Session[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<SessionRow>(
      'SELECT * FROM sessions WHERE route_id = ? ORDER BY started_at DESC',
      [routeId],
    );
    const sessions: Session[] = [];
    for (const row of rows) {
      const events = await sessionRepo.getEventsForSession(row.id);
      sessions.push(rowToSession(row, events));
    }
    return sessions;
  },
};

// ─── Row types (SQLite column names use snake_case) ───────────────────────────

interface RouteRow {
  id: string;
  name: string;
  description: string | null;
  total_distance_km: number;
  geo_json: string;
  created_at: number;
}

interface WaypointRow {
  id: string;
  route_id: string;
  idx: number;
  type: string;
  lat: number;
  lng: number;
  bearing: number | null;
  distance_from_prev: number;
  trigger_radius_m: number;
  mandatory: number;
  note: string | null;
}

interface SessionRow {
  id: string;
  route_id: string;
  started_at: number;
  ended_at: number | null;
  total_distance_km: number;
}

interface EventRow {
  id: string;
  session_id: string;
  waypoint_id: string;
  event_type: string;
  ts: number;
  lat: number;
  lng: number;
}

// ─── Row → domain type converters ─────────────────────────────────────────────

function rowToRoute(row: RouteRow, waypoints: Waypoint[]): Route {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    totalDistanceKm: row.total_distance_km,
    waypoints,
    geoJson: JSON.parse(row.geo_json) as GeoJSON.FeatureCollection,
    createdAt: row.created_at,
  };
}

function rowToWaypoint(row: WaypointRow): Waypoint {
  return {
    id: row.id,
    routeId: row.route_id,
    index: row.idx,
    type: row.type as Waypoint['type'],
    coordinates: { lat: row.lat, lng: row.lng },
    bearing: row.bearing ?? undefined,
    distanceFromPrev: row.distance_from_prev,
    triggerRadiusM: row.trigger_radius_m,
    mandatory: row.mandatory === 1,
    note: row.note ?? undefined,
  };
}

function rowToSession(row: SessionRow, events: SessionEvent[]): Session {
  const missedWaypoints = events
    .filter((e) => e.type === 'MISSED')
    .map((e) => e.waypointId);
  return {
    id: row.id,
    routeId: row.route_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    events,
    missedWaypoints,
    totalDistanceKm: row.total_distance_km,
  };
}

function rowToEvent(row: EventRow): SessionEvent {
  return {
    id: row.id,
    waypointId: row.waypoint_id,
    type: row.event_type as SessionEvent['type'],
    timestamp: row.ts,
    coordinates: { lat: row.lat, lng: row.lng },
  };
}
