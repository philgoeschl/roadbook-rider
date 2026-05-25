import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useRouteStore } from '@/store/routeStore';
import type { Route } from '@/types';

export default function RoutesScreen() {
  const router = useRouter();
  const { routes, isLoading, loadRoutes, deleteRoute } = useRouteStore();

  useEffect(() => {
    loadRoutes();
  }, []);

  function confirmDelete(route: Route) {
    Alert.alert(
      'Delete Route',
      `Delete "${route.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRoute(route.id),
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">My Routes</ThemedText>
        </View>

        {routes.length === 0 && !isLoading && (
          <ThemedView type="backgroundElement" style={styles.emptyState}>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No routes yet. Import a GPX, KML, or GeoJSON file from the Home tab.
            </ThemedText>
          </ThemedView>
        )}

        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RouteRow
              route={item}
              onPress={() => router.push(`/route/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
            />
          )}
          contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function RouteRow({
  route,
  onPress,
  onLongPress,
}: {
  route: Route;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const createdDate = new Date(route.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.routeRowInner}>
        <View style={styles.routeInfo}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {route.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {route.waypoints.length} waypoints · {route.totalDistanceKm.toFixed(1)} km
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {createdDate}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    paddingTop: Spacing.four,
  },
  emptyState: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  routeRow: { marginBottom: Spacing.two },
  routeRowInner: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routeInfo: { flex: 1, gap: Spacing.one },
  pressed: { opacity: 0.7 },
});
