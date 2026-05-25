import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaypointCard } from '@/components/WaypointCard';
import { RoadbookScroll } from '@/components/RoadbookScroll';
import { getBearingToWaypoint, getDistanceToWaypointM, checkProximity } from '@/engine/proximity';
import { formatStageDuration } from '@/engine/stageTimer';
import { useLocation } from '@/hooks/useLocation';
import { useOdometer } from '@/hooks/useOdometer';
import { useStageTimer } from '@/hooks/useStageTimer';
import { useTheme } from '@/hooks/use-theme';
import { useRouteStore } from '@/store/routeStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Coordinates } from '@/types';

export default function RideScreen() {
  useKeepAwake();

  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const theme = useTheme();

  const { routes } = useRouteStore();
  const { activeSession, currentWaypointIndex, recordEvent, advanceWaypoint, endSession, loadSession } =
    useSessionStore();
  const { triggerRadiusM, distanceUnit, penaltyPerMissMs } = useSettingsStore();
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

  const approachEnteredRef = useRef(false);
  const prevDistanceRef = useRef<number | null>(null);

  const [distanceToCurrentM, setDistanceToCurrentM] = useState(0);
  const [bearingToDeg, setBearingToDeg] = useState(0);
  const rideFinishedRef = useRef(false);
  const [penaltyAlert, setPenaltyAlert] = useState<string | null>(null);
  const [showScroll, setShowScroll] = useState(false);
  const [showPassFlash, setShowPassFlash] = useState(false);
  const penaltyAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Visual + haptic feedback on pass
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPassFlash(true);
      if (passFlashTimerRef.current) clearTimeout(passFlashTimerRef.current);
      passFlashTimerRef.current = setTimeout(() => setShowPassFlash(false), 500);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      if (currentWaypoint.mandatory) {
        const msg = `CHECKPOINT MISSED  +${formatStageDuration(penaltyPerMissMs)}`;
        setPenaltyAlert(msg);
        if (penaltyAlertTimerRef.current) clearTimeout(penaltyAlertTimerRef.current);
        penaltyAlertTimerRef.current = setTimeout(() => setPenaltyAlert(null), 3000);
      }

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
    if (rideFinishedRef.current) return;
    rideFinishedRef.current = true;
    try {
      await endSession(odometerKm);
      router.replace(`/session/${sessionId}`);
    } catch {
      // DB write failed — fall back to home so rider isn't stuck
      router.replace('/');
    }
  }

  async function handleSkip() {
    if (!currentWaypoint || !location) return;
    const { latitude: lat, longitude: lng } = location.coords;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recordEvent(currentWaypoint.id, 'SKIPPED', { lat, lng });
    advanceWaypoint();
    approachEnteredRef.current = false;
    prevDistanceRef.current = null;

    if (currentWaypointIndex + 1 >= waypoints.length) {
      handleFinish();
    }
  }

  function handleAbort() {
    const passed = activeSession?.events.filter((e) => e.type === 'PASSED').length ?? 0;
    const total = waypoints.length;
    Alert.alert(
      'End Ride',
      `${passed} of ${total} waypoints passed.`,
      [
        { text: 'Continue Riding', style: 'cancel' },
        {
          text: 'Go Home',
          onPress: async () => {
            if (!rideFinishedRef.current) {
              rideFinishedRef.current = true;
              try { await endSession(odometerKm); } catch { /* best-effort */ }
            }
            router.replace('/');
          },
        },
        { text: 'See Results', style: 'destructive', onPress: handleFinish },
      ],
    );
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

  const borderColor = theme.backgroundElement;

  return (
    <View style={[styles.rideContainer, { backgroundColor: theme.background }]}>
      {/* Green flash overlay on waypoint pass */}
      {showPassFlash && <View style={styles.passFlash} pointerEvents="none" />}

      {/* Penalty alert overlay */}
      {penaltyAlert !== null && (
        <View style={styles.penaltyAlert} pointerEvents="none">
          <ThemedText style={styles.penaltyAlertText}>{penaltyAlert}</ThemedText>
        </View>
      )}

      {/* Main view — card or scroll */}
      {showScroll ? (
        <RoadbookScroll
          waypoints={waypoints}
          currentIndex={currentWaypointIndex}
          events={activeSession.events}
          distanceUnit={distanceUnit}
        />
      ) : (
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
      )}

      {/* Controls: two rows — SKIP/SCROLL on top, END RIDE below (separated to prevent accidental taps) */}
      <SafeAreaView style={[styles.controls, { backgroundColor: theme.background, borderTopColor: borderColor }]} edges={['bottom']}>
        {/* Row 1 — SKIP + SCROLL TOGGLE */}
        <View style={styles.controlsRow}>
          <Pressable
            style={({ pressed }) => [styles.skipButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
            onPress={handleSkip}>
            <ThemedText style={styles.skipText}>SKIP</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.scrollToggle,
              { backgroundColor: theme.backgroundElement },
              showScroll && styles.scrollToggleActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setShowScroll((v) => !v)}>
            <ThemedText style={[styles.scrollToggleText, showScroll && styles.scrollToggleTextActive]}>
              {showScroll ? 'CARD' : 'SCROLL'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Row 2 — END RIDE (full width, clearly distinct) */}
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
  },
  controls: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scrollToggle: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  scrollToggleActive: {
    borderWidth: 2,
    borderColor: '#38A169',
  },
  scrollToggleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#888',
  },
  scrollToggleTextActive: {
    color: '#38A169',
  },

  skipButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },

  abortButton: {
    backgroundColor: '#C0392B',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  abortText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pressed: { opacity: 0.7 },

  passFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(56, 161, 105, 0.35)',
    zIndex: 5,
  },

  penaltyAlert: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  penaltyAlertText: {
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permissionContent: {
    paddingHorizontal: 32,
    gap: 16,
    alignItems: 'center',
  },
  permissionTitle: { textAlign: 'center' },
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
