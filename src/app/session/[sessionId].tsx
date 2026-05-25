import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WAYPOINT_LABEL } from '@/components/WaypointSymbol';
import { Spacing, WaypointColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sessionRepo } from '@/db/schema';
import { computePenalty } from '@/engine/penalty';
import { computeStageStatus, formatStageDuration } from '@/engine/stageTimer';
import { useRouteStore } from '@/store/routeStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Session, Waypoint } from '@/types';

export default function SessionSummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { routes } = useRouteStore();
  const startSession = useSessionStore((s) => s.startSession);
  const { penaltyPerMissMs } = useSettingsStore();

  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    sessionRepo.getSession(sessionId).then(setSession);
  }, [sessionId]);

  const route = routes.find((r) => r.id === session?.routeId) ?? null;

  if (!session || !route) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }

  const durationMs = (session.endedAt ?? Date.now()) - session.startedAt;
  const durationLabel = formatDuration(durationMs);
  const startDate = new Date(session.startedAt).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const passed = session.events.filter((e) => e.type === 'PASSED').length;
  const missed = session.events.filter((e) => e.type === 'MISSED').length;
  const skipped = session.events.filter((e) => e.type === 'SKIPPED').length;

  // Build a per-waypoint result map from events
  const resultMap: Record<string, 'PASSED' | 'MISSED' | 'SKIPPED'> = {};
  for (const event of session.events) {
    resultMap[event.waypointId] = event.type;
  }

  const { completedStages } = computeStageStatus(route.waypoints, session.events);
  const { totalPenaltyMs, penalizedMisses } = computePenalty(
    route.waypoints,
    session.events,
    penaltyPerMissMs,
  );

  async function handleRideAgain() {
    const newSession = await startSession(route!.id);
    router.replace(`/ride/${newSession.id}`);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title">Ride Complete</ThemedText>
          <ThemedText themeColor="textSecondary">{route.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{startDate}</ThemedText>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCell label="TIME" value={durationLabel} />
          <StatCell label="DISTANCE" value={`${session.totalDistanceKm.toFixed(1)} km`} />
          <StatCell label="WAYPOINTS" value={`${route.waypoints.length}`} />
        </View>

        {/* Pass/miss/skip counts */}
        <View style={styles.scoreRow}>
          <ScoreChip count={passed} label="PASSED" color={WaypointColors.passed} />
          <ScoreChip count={missed} label="MISSED" color={WaypointColors.missed} />
          <ScoreChip count={skipped} label="SKIPPED" color={WaypointColors.skipped} />
        </View>

        {/* Penalty (only when mandatory waypoints were missed) */}
        {penalizedMisses > 0 && (
          <View style={styles.penaltyRow}>
            <ThemedText style={styles.penaltyLabel}>
              {penalizedMisses} missed checkpoint{penalizedMisses > 1 ? 's' : ''}
            </ThemedText>
            <ThemedText style={styles.penaltyValue}>
              +{formatStageDuration(totalPenaltyMs)}
            </ThemedText>
          </View>
        )}

        {/* Stage times (only when route has timed stages) */}
        {completedStages.length > 0 && (
          <View style={styles.stagesSection}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.stagesTitle}>
              STAGE TIMES
            </ThemedText>
            {completedStages.map((stage) => (
              <View key={stage.stageNumber} style={styles.stageRow}>
                <ThemedText style={styles.stageNumber}>SS {stage.stageNumber}</ThemedText>
                <ThemedText style={styles.stageDuration}>
                  {formatStageDuration(stage.durationMs)}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Per-waypoint list */}
        <FlatList
          data={route.waypoints}
          keyExtractor={(w) => w.id}
          style={styles.list}
          renderItem={({ item: wp }) => (
            <WaypointResult
              waypoint={wp}
              result={resultMap[wp.id] ?? null}
            />
          )}
        />

        {/* Action buttons */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.rideAgainButton,
              { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleRideAgain}>
            <ThemedText style={[styles.rideAgainText, { color: theme.background }]}>
              ▶ Ride Again
            </ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}
            onPress={() => router.replace('/')}>
            <ThemedText themeColor="textSecondary">Home</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.statCell}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>{label}</ThemedText>
    </ThemedView>
  );
}

function ScoreChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[styles.scoreChip, { backgroundColor: color + '22', borderColor: color }]}>
      <ThemedText style={[styles.scoreCount, { color }]}>{count}</ThemedText>
      <ThemedText style={[styles.scoreLabel, { color }]}>{label}</ThemedText>
    </View>
  );
}

function WaypointResult({
  waypoint,
  result,
}: {
  waypoint: Waypoint;
  result: 'PASSED' | 'MISSED' | 'SKIPPED' | null;
}) {
  const iconMap = { PASSED: '✓', MISSED: '✗', SKIPPED: '⤳' };
  const colorMap = {
    PASSED: WaypointColors.passed,
    MISSED: WaypointColors.missed,
    SKIPPED: WaypointColors.skipped,
  };
  const icon = result ? iconMap[result] : '–';
  const color = result ? colorMap[result] : '#444';

  return (
    <View style={styles.wpRow}>
      <ThemedText style={[styles.resultIcon, { color }]}>{icon}</ThemedText>
      <View style={styles.wpInfo}>
        <ThemedText numberOfLines={1}>{WAYPOINT_LABEL[waypoint.type]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          #{waypoint.index + 1} · {waypoint.type}
          {waypoint.mandatory ? ' · mandatory' : ''}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {result ?? 'no data'}
      </ThemedText>
    </View>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { paddingTop: Spacing.three, gap: Spacing.one },

  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCell: {
    flex: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  statLabel: { letterSpacing: 1 },

  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  scoreChip: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  scoreCount: { fontSize: 22, fontWeight: '800' },
  scoreLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  penaltyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#7f1d1d22',
    borderWidth: 1,
    borderColor: '#dc262633',
  },
  penaltyLabel: { fontSize: 13, fontWeight: '600', color: '#fca5a5' },
  penaltyValue: { fontSize: 18, fontWeight: '800', color: '#f87171', fontVariant: ['tabular-nums'] },

  stagesSection: { gap: Spacing.one },
  stagesTitle: { letterSpacing: 1 },
  stageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#7c2d0022',
    borderWidth: 1,
    borderColor: '#a8380033',
  },
  stageNumber: { fontSize: 13, fontWeight: '700', letterSpacing: 1, color: '#f97316' },
  stageDuration: { fontSize: 18, fontWeight: '700', color: '#fb923c', fontVariant: ['tabular-nums'] },

  list: { flex: 1 },
  wpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f1f',
  },
  resultIcon: { fontSize: 20, fontWeight: '700', width: 28, textAlign: 'center' },
  wpInfo: { flex: 1, gap: 2 },

  footer: { gap: Spacing.two, paddingBottom: Spacing.two },
  rideAgainButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  rideAgainText: { fontWeight: '700', fontSize: 17 },
  homeButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
