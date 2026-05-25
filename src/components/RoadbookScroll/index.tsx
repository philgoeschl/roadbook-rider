import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WaypointColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SessionEvent, Waypoint, WaypointType } from '@/types';

export interface RoadbookScrollProps {
  waypoints: Waypoint[];
  currentIndex: number;
  events: SessionEvent[];
  distanceUnit: 'km' | 'mi';
}

const GLYPH: Record<WaypointType, string> = {
  GO: '↑', KR: '↗', KL: '↖', TR: '→', TL: '←',
  HR: '↳', HL: '↲', UT: '↩', RB: '⟲', FRK: '⑂',
  'CAU-CROSS': '✕', 'CAU-ROCK': '◆', 'CAU-TRACK': '≋', 'CAU-PASS': '△',
  'CAU-SLICK': '~', 'CAU-BUMP': '∧', 'CAU-ROAD': '⚠', 'CAU-TRAFFIC': '⊕',
  CP: '⬡', TC: '⏱', FUEL: '⛽', PARK: 'P', CAMP: '⛺',
  SRV: '⚙', MED: '✚', WPT: '●', SS: '▶', 'SS-END': '■',
  PHOTO: '📷', INFO: 'ℹ', HDG: '🧭', DST: '⇥',
};

const LABEL: Record<WaypointType, string> = {
  GO: 'Go', KR: 'Keep Right', KL: 'Keep Left', TR: 'Turn Right', TL: 'Turn Left',
  HR: 'Hard Right', HL: 'Hard Left', UT: 'U-Turn', RB: 'Roundabout', FRK: 'Fork',
  'CAU-CROSS': 'Crossing', 'CAU-ROCK': 'Rocks', 'CAU-TRACK': 'Track', 'CAU-PASS': 'Pass',
  'CAU-SLICK': 'Slippery', 'CAU-BUMP': 'Bumps', 'CAU-ROAD': 'Hazard', 'CAU-TRAFFIC': 'Traffic',
  CP: 'Checkpoint', TC: 'Time Control', FUEL: 'Fuel', PARK: 'Parking', CAMP: 'Camp',
  SRV: 'Service', MED: 'Medical', WPT: 'Waypoint', SS: 'Stage Start', 'SS-END': 'Stage End',
  PHOTO: 'Photo', INFO: 'Info', HDG: 'Heading', DST: 'Distance',
};

function typeColor(type: WaypointType): string {
  if (['GO','KR','KL','TR','TL','HR','HL','UT','RB','FRK'].includes(type)) return WaypointColors.navigation;
  if (type.startsWith('CAU-')) return WaypointColors.hazard;
  if (type === 'HDG' || type === 'DST') return WaypointColors.bearing;
  return WaypointColors.special;
}

function formatDist(km: number, unit: 'km' | 'mi'): string {
  if (km === 0) return 'start';
  if (unit === 'mi') return `+${(km * 0.621371).toFixed(2)}mi`;
  return `+${km.toFixed(2)}km`;
}

type RowState = 'past' | 'current' | 'future';
type EventResult = 'PASSED' | 'MISSED' | 'SKIPPED' | null;

const RESULT_ICON: Record<NonNullable<EventResult>, string> = {
  PASSED: '✓',
  MISSED: '✗',
  SKIPPED: '⤳',
};

const RESULT_COLOR: Record<NonNullable<EventResult>, string> = {
  PASSED: WaypointColors.passed,
  MISSED: WaypointColors.missed,
  SKIPPED: WaypointColors.skipped,
};

interface RowItem {
  waypoint: Waypoint;
  state: RowState;
  result: EventResult;
}

export function RoadbookScroll({
  waypoints,
  currentIndex,
  events,
  distanceUnit,
}: RoadbookScrollProps) {
  const theme = useTheme();
  const listRef = useRef<FlatList<RowItem>>(null);

  const resultMap = new Map<string, EventResult>();
  for (const e of events) resultMap.set(e.waypointId, e.type);

  const data: RowItem[] = waypoints.map((wp, i) => ({
    waypoint: wp,
    state: i < currentIndex ? 'past' : i === currentIndex ? 'current' : 'future',
    result: resultMap.get(wp.id) ?? null,
  }));

  function scrollToCurrent(animated: boolean) {
    if (waypoints.length === 0) return;
    const index = Math.min(currentIndex, waypoints.length - 1);
    listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated });
  }

  // Scroll when the current waypoint advances during a ride
  useEffect(() => {
    scrollToCurrent(true);
  }, [currentIndex, waypoints.length]);

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item) => item.waypoint.id}
      style={[styles.list, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <ScrollRow item={item} distanceUnit={distanceUnit} />
      )}
      // Scroll to current immediately once the list is laid out (handles fresh mount on view switch)
      onLayout={() => scrollToCurrent(false)}
      onScrollToIndexFailed={({ index }) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: false });
        }, 150);
      }}
    />
  );
}

function ScrollRow({
  item: { waypoint: wp, state, result },
  distanceUnit,
}: {
  item: RowItem;
  distanceUnit: 'km' | 'mi';
}) {
  const theme = useTheme();
  const color = typeColor(wp.type);
  const isCurrent = state === 'current';
  const isPast = state === 'past';

  // Past rows: use result color for the circle so it's immediately readable (✓ green / ✗ red)
  const circleColor = isPast && result ? RESULT_COLOR[result] : color;
  const rowBg = isCurrent ? theme.backgroundElement : 'transparent';
  const borderColor = theme.backgroundElement;

  return (
    <View style={[styles.row, { borderBottomColor: borderColor, backgroundColor: rowBg }]}>
      {/* Current indicator stripe */}
      <View style={[styles.stripe, { backgroundColor: isCurrent ? color : 'transparent' }]} />

      {/* Index */}
      <ThemedText style={[styles.index, { color: isPast ? theme.textSecondary : theme.textSecondary }]}>
        {wp.index + 1}
      </ThemedText>

      {/* Symbol circle */}
      <View style={[styles.circle, { backgroundColor: circleColor }]}>
        <ThemedText style={styles.glyph}>
          {isPast && result ? RESULT_ICON[result] : GLYPH[wp.type]}
        </ThemedText>
      </View>

      {/* Type + label */}
      <View style={styles.labelCol}>
        <ThemedText style={[styles.typeCode, { color: isPast ? theme.textSecondary : color }]}>
          {wp.type}
        </ThemedText>
        <ThemedText
          style={[
            styles.labelText,
            { color: isCurrent ? theme.text : theme.textSecondary },
            isCurrent && styles.labelCurrent,
          ]}
          numberOfLines={1}>
          {LABEL[wp.type]}
          {wp.mandatory ? '  ·  CP' : ''}
        </ThemedText>
      </View>

      {/* Distance from previous */}
      <ThemedText style={[styles.dist, { color: theme.textSecondary }]}>
        {formatDist(wp.distanceFromPrev, distanceUnit)}
      </ThemedText>

      {/* Result text for past waypoints (shown next to circle, additional context) */}
      {isPast && result !== null ? (
        <ThemedText style={[styles.resultLabel, { color: RESULT_COLOR[result] }]}>
          {result}
        </ThemedText>
      ) : (
        <View style={styles.resultPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingVertical: Spacing.four,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // rowPast intentionally removed — past rows are NOT dimmed; result color on circle conveys state

  stripe: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },

  index: {
    width: 28,
    textAlign: 'right',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },

  labelCol: {
    flex: 1,
    gap: 2,
  },
  typeCode: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  labelCurrent: {
    fontWeight: '700',
    fontSize: 16,
  },

  dist: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    minWidth: 56,
  },

  resultLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    width: 52,
    textAlign: 'right',
  },
  resultPlaceholder: {
    width: 52,
  },
});
