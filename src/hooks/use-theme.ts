/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme() {
  const { theme } = useSettingsStore();
  const scheme = useColorScheme();

  if (theme === 'sunlight') return Colors.sunlight;
  if (theme === 'dark') return Colors.dark;
  if (theme === 'light') return Colors.light;

  // auto — follow OS preference
  const osScheme = scheme === 'unspecified' ? 'light' : scheme;
  return Colors[osScheme];
}
