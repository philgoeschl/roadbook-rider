import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { routeRepo } from '@/db/schema';
import { parseRouteFile } from '@/engine/routeParser';
import { generateWaypoints } from '@/engine/waypointGen';
import type { Route, Waypoint } from '@/types';

interface RouteState {
  routes: Route[];
  isLoading: boolean;
  error: string | null;

  loadRoutes: () => Promise<void>;
  importRoute: (uri: string, fileName: string) => Promise<Route>;
  deleteRoute: (routeId: string) => Promise<void>;
  updateWaypoints: (routeId: string, waypoints: Waypoint[]) => Promise<void>;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  isLoading: false,
  error: null,

  loadRoutes: async () => {
    set({ isLoading: true, error: null });
    try {
      const routes = await routeRepo.getAllRoutes();
      set({ routes, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  importRoute: async (uri: string, fileName: string): Promise<Route> => {
    set({ isLoading: true, error: null });
    try {
      const { geoJson, name } = await parseRouteFile(uri, fileName);
      const routeId = Crypto.randomUUID();
      const waypoints = generateWaypoints(geoJson, routeId);
      const totalDistanceKm = waypoints.reduce((acc, wp) => acc + wp.distanceFromPrev, 0);

      const route: Route = {
        id: routeId,
        name,
        totalDistanceKm,
        waypoints,
        geoJson,
        createdAt: Date.now(),
      };

      await routeRepo.insertRoute(route);
      set((s) => ({ routes: [route, ...s.routes], isLoading: false }));
      return route;
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },

  deleteRoute: async (routeId: string) => {
    await routeRepo.deleteRoute(routeId);
    set((s) => ({ routes: s.routes.filter((r) => r.id !== routeId) }));
  },

  updateWaypoints: async (routeId: string, waypoints: Waypoint[]) => {
    await routeRepo.updateWaypoints(routeId, waypoints);
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              waypoints,
              totalDistanceKm: waypoints.reduce((acc, wp) => acc + wp.distanceFromPrev, 0),
            }
          : r,
      ),
    }));
  },
}));
