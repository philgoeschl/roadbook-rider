import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WAYPOINT_LABEL } from '@/components/WaypointSymbol';
import { Spacing, WaypointColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouteStore } from '@/store/routeStore';
import { useSessionStore } from '@/store/sessionStore';
import type { Route, Waypoint, WaypointType } from '@/types';

// All types the editor can assign, grouped for display
const EDITABLE_TYPES: WaypointType[] = [
  'GO', 'KR', 'KL', 'TR', 'TL', 'HR', 'HL', 'UT', 'RB', 'FRK',
  'CP', 'TC', 'FUEL', 'PARK', 'CAMP', 'SRV', 'MED', 'WPT', 'SS', 'SS-END', 'PHOTO', 'INFO',
  'CAU-CROSS', 'CAU-ROCK', 'CAU-TRACK', 'CAU-PASS', 'CAU-SLICK', 'CAU-BUMP', 'CAU-ROAD', 'CAU-TRAFFIC',
];

function typeColor(type: WaypointType): string {
  if (['GO','KR','KL','TR','TL','HR','HL','UT','RB','FRK'].includes(type)) return WaypointColors.navigation;
  if (type.startsWith('CAU-')) return WaypointColors.hazard;
  return WaypointColors.special;
}

export default function RouteScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { routes, updateWaypoints } = useRouteStore();
  const startSession = useSessionStore((s) => s.startSession);

  const route = routes.find((r) => r.id === routeId) ?? null;
  const [waypoints, setWaypoints] = useState<Waypoint[]>(route?.waypoints ?? []);
  const [editingWpId, setEditingWpId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route) setWaypoints(route.waypoints);
  }, [route?.id]);

  if (!route) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const bbox = boundingBox(route);

  function changeType(wpId: string, newType: WaypointType) {
    setWaypoints((prev) => prev.map((w) => (w.id === wpId ? { ...w, type: newType } : w)));
    setEditingWpId(null);
  }

  function removeWaypoint(wpId: string) {
    setWaypoints((prev) => {
      const filtered = prev.filter((w) => w.id !== wpId);
      return filtered.map((w, i) => ({ ...w, index: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateWaypoints(route!.id, waypoints);
    } finally {
      setSaving(false);
    }
  }

  async function handleStartRide() {
    await handleSave();
    const session = await startSession(route!.id);
    router.push(`/ride/${session.id}`);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText themeColor="textSecondary">‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.routeName}>
            {route.name}
          </ThemedText>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={12}>
            {saving
              ? <ActivityIndicator size="small" />
              : <ThemedText themeColor="textSecondary">Save</ThemedText>}
          </Pressable>
        </View>

        {/* Route summary */}
        <ThemedView type="backgroundElement" style={styles.summaryCard}>
          <ThemedText type="small" themeColor="textSecondary">{bbox}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {waypoints.length} waypoints · {route.totalDistanceKm.toFixed(1)} km
          </ThemedText>
        </ThemedView>

        {/* Waypoint list */}
        <FlatList
          data={waypoints}
          keyExtractor={(w) => w.id}
          style={styles.list}
          renderItem={({ item: wp }) => (
            <WaypointRow
              wp={wp}
              isEditing={editingWpId === wp.id}
              onToggleEdit={() => setEditingWpId(editingWpId === wp.id ? null : wp.id)}
              onChangeType={(t) => changeType(wp.id, t)}
              onDelete={() => {
                Alert.alert('Remove Waypoint', `Remove ${WAYPOINT_LABEL[wp.type]}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeWaypoint(wp.id) },
                ]);
              }}
            />
          )}
        />

        {/* Start Ride button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleStartRide}>
            <ThemedText
              style={[styles.startButtonText, { color: theme.background }]}
              type="subtitle">
              ▶ Start Ride
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function WaypointRow({
  wp,
  isEditing,
  onToggleEdit,
  onChangeType,
  onDelete,
}: {
  wp: Waypoint;
  isEditing: boolean;
  onToggleEdit: () => void;
  onChangeType: (t: WaypointType) => void;
  onDelete: () => void;
}) {
  const color = typeColor(wp.type);

  return (
    <View style={styles.wpRow}>
      <ThemedView type="backgroundElement" style={styles.wpRowInner}>
        {/* Index + type badge */}
        <View style={[styles.typeBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <ThemedText style={[styles.typeBadgeText, { color }]}>{wp.type}</ThemedText>
        </View>

        {/* Label + distance */}
        <View style={styles.wpInfo}>
          <ThemedText numberOfLines={1}>{WAYPOINT_LABEL[wp.type]}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            #{wp.index + 1} · {wp.distanceFromPrev > 0 ? `+${wp.distanceFromPrev.toFixed(2)} km` : 'start'}
            {wp.mandatory ? ' · mandatory' : ''}
          </ThemedText>
        </View>

        {/* Edit / delete controls */}
        <Pressable onPress={onToggleEdit} hitSlop={8} style={styles.editBtn}>
          <ThemedText themeColor="textSecondary">{isEditing ? '✕' : '✎'}</ThemedText>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
          <ThemedText style={styles.deleteText}>🗑</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Type picker (shown when editing) */}
      {isEditing && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typePicker}
          contentContainerStyle={styles.typePickerContent}>
          {EDITABLE_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => onChangeType(t)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: typeColor(t) + '22',
                  borderColor: wp.type === t ? typeColor(t) : 'transparent',
                },
              ]}>
              <ThemedText style={[styles.typeChipText, { color: typeColor(t) }]}>{t}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function boundingBox(route: Route): string {
  const coords = route.waypoints.map((w) => w.coordinates);
  if (coords.length === 0) return 'No waypoints';
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats).toFixed(4);
  const maxLat = Math.max(...lats).toFixed(4);
  const minLng = Math.min(...lngs).toFixed(4);
  const maxLng = Math.max(...lngs).toFixed(4);
  return `${minLat}°N ${minLng}°E  →  ${maxLat}°N ${maxLng}°E`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  routeName: { flex: 1, textAlign: 'center' },

  summaryCard: {
    marginHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },

  list: { flex: 1, paddingHorizontal: Spacing.three },

  wpRow: { marginBottom: Spacing.two },
  wpRowInner: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  typeBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    borderWidth: 1,
    minWidth: 52,
    alignItems: 'center',
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  wpInfo: { flex: 1, gap: 2 },
  editBtn: { padding: Spacing.one },
  deleteBtn: { padding: Spacing.one },
  deleteText: { fontSize: 16 },

  typePicker: { marginTop: Spacing.one },
  typePickerContent: { gap: Spacing.one, paddingHorizontal: Spacing.one, paddingBottom: Spacing.one },
  typeChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 11, fontWeight: '700' },

  footer: {
    padding: Spacing.three,
    paddingBottom: Spacing.four,
  },
  startButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  startButtonText: { fontWeight: '700' },
});
