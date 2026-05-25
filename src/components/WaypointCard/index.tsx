import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WaypointSymbol } from '@/components/WaypointSymbol';
import { Spacing } from '@/constants/theme';
import type { Waypoint } from '@/types';

export interface WaypointCardProps {
  current: Waypoint;
  currentIndex: number;
  totalCount: number;
  next: Waypoint | null;
  distanceToCurrentM: number;
  headingDeg: number | null;   // from GPS, null until first fix
  bearingToDeg: number;        // computed bearing to current waypoint
  distanceUnit: 'km' | 'mi';
  odometerKm: number;
}

export function WaypointCard({
  current,
  currentIndex,
  totalCount,
  next,
  distanceToCurrentM,
  headingDeg,
  bearingToDeg,
  distanceUnit,
  odometerKm,
}: WaypointCardProps) {
  const distanceLabel = formatDistance(distanceToCurrentM, distanceUnit);
  const headingLabel = headingDeg !== null ? `${Math.round(headingDeg)}°` : '---';
  const bearingLabel = `${Math.round(bearingToDeg)}°`;
  const odoLabel = formatOdo(odometerKm, distanceUnit);

  return (
    <View style={styles.card}>
      {/* Zone 1 — header bar */}
      <View style={styles.headerBar}>
        <ThemedText style={styles.headerCounter}>
          #{currentIndex + 1} / {totalCount}
        </ThemedText>
        <ThemedText style={styles.headerDistance}>
          {distanceLabel} →
        </ThemedText>
      </View>

      {/* Zone 2 — symbol */}
      <View style={styles.symbolZone}>
        <WaypointSymbol type={current.type} size="large" />
      </View>

      {/* Zone 3 — compass bar */}
      <View style={styles.compassBar}>
        <CompassCell icon="↑" label="HDG" value={headingLabel} />
        <View style={styles.compassDivider} />
        <CompassCell icon="🧭" label="BRG" value={bearingLabel} />
        <View style={styles.compassDivider} />
        <CompassCell icon="📏" label="ODO" value={odoLabel} />
      </View>

      {/* Zone 4 — next waypoint bar */}
      <View style={styles.nextBar}>
        {next ? (
          <>
            <ThemedText style={styles.nextLabel}>NEXT</ThemedText>
            <WaypointSymbol type={next.type} size="small" />
            <ThemedText style={styles.nextDistance}>
              {formatDistance(next.distanceFromPrev * 1000, distanceUnit)}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.nextLabel}>LAST WAYPOINT</ThemedText>
        )}
      </View>
    </View>
  );
}

function CompassCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.compassCell}>
      <ThemedText style={styles.compassIcon}>{icon}</ThemedText>
      <ThemedText style={styles.compassValue}>{value}</ThemedText>
      <ThemedText style={styles.compassLabel}>{label}</ThemedText>
    </View>
  );
}

function formatOdo(km: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') return `${(km * 0.621371).toFixed(1)}mi`;
  return `${km.toFixed(1)}km`;
}

function formatDistance(distanceM: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') {
    const miles = distanceM / 1609.344;
    return miles < 0.1 ? `${Math.round(distanceM * 3.281)}ft` : `${miles.toFixed(1)}mi`;
  }
  return distanceM < 1000
    ? `${Math.round(distanceM)}m`
    : `${(distanceM / 1000).toFixed(1)}km`;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // Zone 1
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  headerCounter: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
  },
  headerDistance: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Zone 2
  symbolZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },

  // Zone 3
  compassBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  compassCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  compassDivider: {
    width: 1,
    backgroundColor: '#1f1f1f',
  },
  compassIcon: {
    fontSize: 18,
    color: '#888',
  },
  compassValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  compassLabel: {
    fontSize: 11,
    color: '#555',
    letterSpacing: 1,
  },

  // Zone 4
  nextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: 60,
  },
  nextLabel: {
    fontSize: 13,
    color: '#555',
    letterSpacing: 1,
    fontWeight: '600',
  },
  nextDistance: {
    fontSize: 16,
    color: '#888',
    marginLeft: 'auto',
  },
});
