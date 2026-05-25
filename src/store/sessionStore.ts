import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { sessionRepo } from '@/db/schema';
import type { Session, SessionEvent, SessionEventType, Coordinates } from '@/types';

interface SessionState {
  activeSession: Session | null;
  currentWaypointIndex: number;

  startSession: (routeId: string) => Promise<Session>;
  recordEvent: (
    waypointId: string,
    type: SessionEventType,
    coords: Coordinates,
  ) => Promise<void>;
  advanceWaypoint: () => void;
  endSession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<Session | null>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  currentWaypointIndex: 0,

  startSession: async (routeId: string): Promise<Session> => {
    const session: Session = {
      id: Crypto.randomUUID(),
      routeId,
      startedAt: Date.now(),
      events: [],
      missedWaypoints: [],
      totalDistanceKm: 0,
    };
    await sessionRepo.insertSession(session);
    set({ activeSession: session, currentWaypointIndex: 0 });
    return session;
  },

  recordEvent: async (
    waypointId: string,
    type: SessionEventType,
    coords: Coordinates,
  ): Promise<void> => {
    const { activeSession } = get();
    if (!activeSession) return;

    const event: SessionEvent = {
      id: Crypto.randomUUID(),
      waypointId,
      type,
      timestamp: Date.now(),
      coordinates: coords,
    };

    await sessionRepo.insertEvent(activeSession.id, event);

    set((s) => {
      if (!s.activeSession) return s;
      const updatedSession: Session = {
        ...s.activeSession,
        events: [...s.activeSession.events, event],
        missedWaypoints:
          type === 'MISSED'
            ? [...s.activeSession.missedWaypoints, waypointId]
            : s.activeSession.missedWaypoints,
      };
      return { activeSession: updatedSession };
    });
  },

  advanceWaypoint: () => {
    set((s) => ({ currentWaypointIndex: s.currentWaypointIndex + 1 }));
  },

  endSession: async (): Promise<void> => {
    const { activeSession } = get();
    if (!activeSession) return;

    const ended: Session = { ...activeSession, endedAt: Date.now() };
    await sessionRepo.updateSession(ended);
    set({ activeSession: ended });
  },

  loadSession: async (sessionId: string): Promise<Session | null> => {
    const session = await sessionRepo.getSession(sessionId);
    if (session) set({ activeSession: session, currentWaypointIndex: session.events.length });
    return session;
  },
}));
