import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaypointCard } from '@/components/WaypointCard';
import { getBearingToWaypoint, getDistanceToWaypointM, checkProximity } from '@/engine/proximity';
import { useLocation } from '@/hooks/useLocation';
import { useOdometer } from '@/hooks/useOdometer';
import { useStageTimer } from '@/hooks/useStageTimer';
import { useRouteStore } from '@/store/routeStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Coordinates } from '@/types';

export default function RideScreen() {
  useKeepAwake();

  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();

  const { routes } = useRouteStore();
  const { activeSession, currentWaypointIndex, recordEvent, advanceWaypoint, endSession, loadSession } =
    useSessionStore();
  const { triggerRadiusM, distanceUnit } = useSettingsStore();
  const { location, heading, permissionStatus, requestPermission } = useLocation();
  const odometerKm = useOdometer(location);

  // Load session if navigating directly to this screen (e.g. app restart)
  useEffect(() => {
    if (!activeSession || activeSession.id !== sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const route = routes.find((r) => r.id === activeSession?.routeId) ?? null;
  const waypoints = route?.waypoints ?? [];

  const { isInStage, elapsedMs: stageElapsedMs } = useStageTimer(
    waypoints,
    activeSession?.events ?? [],
  );
  const currentWaypoint = waypoints[currentWaypointIndex] ?? null;
  const nextWaypoint = waypoints[currentWaypointIndex + 1] ?? null;

  // Track whether rider has entered the approach zone (within 3× radius)
  // to detect a MISSED waypoint when they exit it without triggering.
  const approachEnteredRef = useRef(false);
  const prevDistanceRef = useRef<number | null>(null);

  const [distanceToCurrentM, setDistanceToCurrentM] = useState(0);
  const [bearingToDeg, setBearingToDeg] = useState(0);
  const [rideFinished, setRideFinished] = useState(false);

  // GPS update loop
  useEffect(() => {
    if (!location || !currentWaypoint) return;

    const { latitude: lat, longitude: lng } = location.coords;
    const wpLat = currentWaypoint.coordinates.lat;
    const wpLng = currentWaypoint.coordinates.lng;

    const distM = getDistanceToWaypointM(lat, lng, wpLat, wpLng);
    const bearing = getBearingToWaypoint(lat, lng, wpLat, wpLng);
    setDistanceToCurrentM(distM);
    setBearingToDeg(bearing);

    const coords: Coordinates = { lat, lng };
    const radius = currentWaypoint.triggerRadiusM ?? triggerRadiusM;

    // PASSED: rider entered trigger radius
    if (checkProximity(lat, lng, wpLat, wpLng, radius)) {
      recordEvent(currentWaypoint.id, 'PASSED', coords);
      advanceWaypoint();
      approachEnteredRef.current = false;
      prevDistanceRef.current = null;

      if (currentWaypointIndex + 1 >= waypoints.length) {
        handleFinish();
      }
      return;
    }

    // Track approach zone (3× radius) for MISSED detection
    const approachZone = radius * 3;
    if (distM <= approachZone) {
      approachEnteredRef.current = true;
    }

    // MISSED: rider was in approach zone, now moving away (distance increasing by >2× radius)
    if (
      approachEnteredRef.current &&
      prevDistanceRef.current !== null &&
      distM > prevDistanceRef.current + radius * 2
    ) {
      recordEvent(currentWaypoint.id, 'MISSED', coords);
      advanceWaypoint();
      approachEnteredRef.current = false;
      prevDistanceRef.current = null;

      if (currentWaypointIndex + 1 >= waypoints.length) {
        handleFinish();
      }
      return;
    }

    prevDistanceRef.current = distM;
  }, [location]);

  async function handleFinish() {
    if (rideFinished) return;
    setRideFinished(true);
    await endSession(odometerKm);
    router.replace(`/session/${sessionId}`);
  }

  async function handleSkip() {
    if (!currentWaypoint || !location) return;
    const { latitude: lat, longitude: lng } = location.coords;
    await recordEvent(currentWaypoint.id, 'SKIPPED', { lat, lng });
    advanceWaypoint();
    approachEnteredRef.current = false;
    prevDistanceRef.current = null;

    if (currentWaypointIndex + 1 >= waypoints.length) {
      handleFinish();
    }
  }

  function handleAbort() {
    Alert.alert('End Ride', 'Stop the current ride?', [
      { text: 'Continue', style: 'cancel' },
      { text: 'End Ride', style: 'destructive', onPress: handleFinish },
    ]);
  }

  // Permission wall
  if (permissionStatus !== 'granted') {
    return (
      <ThemedView style={styles.centered}>
        <SafeAreaView style={styles.permissionContent}>
          <ThemedText type="subtitle" style={styles.permissionTitle}>
            Location Access Required
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.permissionBody}>
            RoadbookRider needs your location to detect waypoint passages during the ride.
          </ThemedText>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <ThemedText style={styles.permissionButtonText}>Grant Permission</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!currentWaypoint || !activeSession) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading ride…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <View style={styles.rideContainer}>
      {/* Full-screen waypoint card */}
      <WaypointCard
        current={currentWaypoint}
        currentIndex={currentWaypointIndex}
        totalCount={waypoints.length}
        next={nextWaypoint}
        distanceToCurrentM={distanceToCurrentM}
        headingDeg={heading}
        bearingToDeg={bearingToDeg}
        distanceUnit={distanceUnit}
        odometerKm={odometerKm}
        stageElapsedMs={isInStage ? stageElapsedMs : null}
      />

      {/* Controls overlay at the bottom */}
      <SafeAreaView style={styles.controls} edges={['bottom']}>
        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          onPress={handleSkip}>
          <ThemedText style={styles.skipText}>SKIP</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.abortButton, pressed && styles.pressed]}
          onPress={handleAbort}>
          <ThemedText style={styles.abortText}>END RIDE</ThemedText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rideContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  skipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  abortButton: {
    backgroundColor: '#1a0000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  abortText: {
    color: '#E53E3E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pressed: { opacity: 0.7 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  permissionContent: {
    paddingHorizontal: 32,
    gap: 16,
    alignItems: 'center',
  },
  permissionTitle: { color: '#fff', textAlign: 'center' },
  permissionBody: { textAlign: 'center', lineHeight: 22 },
  permissionButton: {
    backgroundColor: '#3182CE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
