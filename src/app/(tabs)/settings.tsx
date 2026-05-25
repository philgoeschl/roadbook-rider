import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';
import type { AppSettings } from '@/types';

const RADIUS_OPTIONS = [25, 50, 75, 100, 150, 200] as const;
const PENALTY_OPTIONS = [
  { label: '1 min', ms: 1 * 60 * 1000 },
  { label: '2 min', ms: 2 * 60 * 1000 },
  { label: '5 min', ms: 5 * 60 * 1000 },
  { label: '10 min', ms: 10 * 60 * 1000 },
] as const;

export default function SettingsScreen() {
  const { triggerRadiusM, distanceUnit, theme, penaltyPerMissMs, updateSettings } = useSettingsStore();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
        </View>

        <SettingsSection title="NAVIGATION">
          <SettingsRow label="Waypoint trigger radius">
            <View style={styles.optionRow}>
              {RADIUS_OPTIONS.map((r) => (
                <OptionChip
                  key={r}
                  label={`${r}m`}
                  selected={triggerRadiusM === r}
                  onPress={() => updateSettings({ triggerRadiusM: r })}
                />
              ))}
            </View>
          </SettingsRow>

          <SettingsRow label="Distance units">
            <View style={styles.optionRow}>
              {(['km', 'mi'] as AppSettings['distanceUnit'][]).map((unit) => (
                <OptionChip
                  key={unit}
                  label={unit}
                  selected={distanceUnit === unit}
                  onPress={() => updateSettings({ distanceUnit: unit })}
                />
              ))}
            </View>
          </SettingsRow>

          <SettingsRow label="Penalty per missed checkpoint">
            <View style={styles.optionRow}>
              {PENALTY_OPTIONS.map((opt) => (
                <OptionChip
                  key={opt.ms}
                  label={opt.label}
                  selected={penaltyPerMissMs === opt.ms}
                  onPress={() => updateSettings({ penaltyPerMissMs: opt.ms })}
                />
              ))}
            </View>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="APPEARANCE">
          <SettingsRow label="Theme">
            <View style={styles.optionRow}>
              {(['auto', 'light', 'dark', 'sunlight'] as AppSettings['theme'][]).map((t) => (
                <OptionChip
                  key={t}
                  label={t === 'sunlight' ? 'Sunlight' : t.charAt(0).toUpperCase() + t.slice(1)}
                  selected={theme === t}
                  onPress={() => updateSettings({ theme: t })}
                />
              ))}
            </View>
          </SettingsRow>
        </SettingsSection>
      </SafeAreaView>
    </ThemedView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.sectionCard}>
        {children}
      </ThemedView>
    </View>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingsRow}>
      <ThemedText>{label}</ThemedText>
      {children}
    </View>
  );
}

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <ThemedView
      type={selected ? 'backgroundSelected' : 'backgroundElement'}
      style={[styles.chip, selected && styles.chipSelected]}
      onTouchEnd={onPress}>
      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: { paddingTop: Spacing.four },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1 },
  sectionCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  settingsRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  chipSelected: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
  },
});
