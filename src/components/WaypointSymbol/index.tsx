import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WaypointColors } from '@/constants/theme';
import type { WaypointType } from '@/types';

export interface WaypointSymbolProps {
  type: WaypointType;
  size?: 'small' | 'large';
}

// Unicode glyphs — large enough to read at a glance through a helmet visor
const GLYPH: Record<WaypointType, string> = {
  GO: '↑',
  KR: '↗',
  KL: '↖',
  TR: '→',
  TL: '←',
  HR: '↳',
  HL: '↲',
  UT: '↩',
  RB: '⟲',
  FRK: '⑂',
  'CAU-CROSS': '✕',
  'CAU-ROCK': '◆',
  'CAU-TRACK': '≋',
  'CAU-PASS': '△',
  'CAU-SLICK': '~',
  'CAU-BUMP': '∧',
  'CAU-ROAD': '⚠',
  'CAU-TRAFFIC': '⊕',
  CP: '⬡',
  TC: '⏱',
  FUEL: '⛽',
  PARK: 'P',
  CAMP: '⛺',
  SRV: '⚙',
  MED: '✚',
  WPT: '●',
  SS: '▶',
  'SS-END': '■',
  PHOTO: '📷',
  INFO: 'ℹ',
  HDG: '🧭',
  DST: '⇥',
};

const LABEL: Record<WaypointType, string> = {
  GO: 'GO',
  KR: 'KEEP RIGHT',
  KL: 'KEEP LEFT',
  TR: 'TURN RIGHT',
  TL: 'TURN LEFT',
  HR: 'HARD RIGHT',
  HL: 'HARD LEFT',
  UT: 'U-TURN',
  RB: 'ROUNDABOUT',
  FRK: 'FORK',
  'CAU-CROSS': 'CROSSING',
  'CAU-ROCK': 'ROCKS',
  'CAU-TRACK': 'TRACK',
  'CAU-PASS': 'PASS',
  'CAU-SLICK': 'SLIPPERY',
  'CAU-BUMP': 'BUMPS',
  'CAU-ROAD': 'ROAD HAZARD',
  'CAU-TRAFFIC': 'TRAFFIC',
  CP: 'CHECKPOINT',
  TC: 'TIME CONTROL',
  FUEL: 'FUEL',
  PARK: 'PARKING',
  CAMP: 'CAMP',
  SRV: 'SERVICE',
  MED: 'MEDICAL',
  WPT: 'WAYPOINT',
  SS: 'START',
  'SS-END': 'FINISH',
  PHOTO: 'PHOTO',
  INFO: 'INFO',
  HDG: 'HEADING',
  DST: 'DISTANCE',
};

function categoryColor(type: WaypointType): string {
  if (
    type === 'GO' ||
    type === 'KR' ||
    type === 'KL' ||
    type === 'TR' ||
    type === 'TL' ||
    type === 'HR' ||
    type === 'HL' ||
    type === 'UT' ||
    type === 'RB' ||
    type === 'FRK'
  ) {
    return WaypointColors.navigation;
  }
  if (type.startsWith('CAU-')) return WaypointColors.hazard;
  if (type === 'HDG' || type === 'DST') return WaypointColors.bearing;
  return WaypointColors.special;
}

export function WaypointSymbol({ type, size = 'large' }: WaypointSymbolProps) {
  const color = categoryColor(type);
  const isLarge = size === 'large';
  const circleSize = isLarge ? 140 : 44;
  const glyphSize = isLarge ? 64 : 22;
  const labelSize = isLarge ? 18 : 11;

  return (
    <View style={[styles.wrapper, isLarge && styles.wrapperLarge]}>
      <View
        style={[
          styles.circle,
          { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: color },
        ]}>
        <ThemedText style={[styles.glyph, { fontSize: glyphSize, color: '#fff' }]}>
          {GLYPH[type]}
        </ThemedText>
      </View>
      {isLarge && (
        <ThemedText style={[styles.label, { fontSize: labelSize, color }]}>
          {LABEL[type]}
        </ThemedText>
      )}
    </View>
  );
}

export { LABEL as WAYPOINT_LABEL };

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 10,
  },
  wrapperLarge: {
    gap: 14,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: undefined,
  },
  label: {
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
