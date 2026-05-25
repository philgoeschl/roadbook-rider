import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouteStore } from '@/store/routeStore';
import type { Route } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { routes, isLoading, importRoute } = useRouteStore();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImport() {
    setImportError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const fileName = asset.name ?? 'Imported Route';

    // Validate extension before handing off to parser
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!['gpx', 'kml', 'geojson', 'json'].includes(ext)) {
      setImportError(`Unsupported file type: .${ext}. Use .gpx, .kml, or .geojson`);
      return;
    }

    setImporting(true);
    try {
      const route = await importRoute(asset.uri, fileName);
      router.push(`/route/${route.id}`);
    } catch (e) {
      setImportError(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">RoadbookRider</ThemedText>
          <ThemedText themeColor="textSecondary">Rally-raid navigation</ThemedText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.importButton,
            { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleImport}
          disabled={importing}>
          {importing ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText
              style={[styles.importButtonText, { color: theme.background }]}
              type="subtitle">
              + Import Route
            </ThemedText>
          )}
        </Pressable>

        {importError && (
          <ThemedText themeColor="textSecondary" style={styles.errorText}>
            {importError}
          </ThemedText>
        )}

        {routes.length > 0 && (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              RECENT ROUTES
            </ThemedText>
            <FlatList
              data={routes.slice(0, 5)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <RouteRow route={item} onPress={() => router.push(`/route/${item.id}`)} />
              )}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
            />
          </>
        )}

        {routes.length === 0 && !isLoading && (
          <ThemedView type="backgroundElement" style={styles.emptyState}>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Import a GPX, KML, or GeoJSON route file to get started.
            </ThemedText>
          </ThemedView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function RouteRow({ route, onPress }: { route: Route; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.routeRowInner}>
        <View style={styles.routeRowText}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {route.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {route.waypoints.length} waypoints · {route.totalDistanceKm.toFixed(1)} km
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
    gap: Spacing.one,
  },
  importButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  importButtonText: {
    fontWeight: '700',
  },
  errorText: {
    textAlign: 'center',
  },
  sectionLabel: {
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  list: { flex: 1 },
  emptyState: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    marginTop: Spacing.two,
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
  routeRowText: { flex: 1, gap: Spacing.one },
  pressed: { opacity: 0.7 },
});
