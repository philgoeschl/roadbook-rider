import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';
import type { AppSettings } from '@/types';

const SETTINGS_PATH = `${FileSystem.documentDirectory}settings.json`;

// expo-file-system adapter for zustand persist
const expoFileStorage = createJSONStorage(() => ({
  getItem: async (_key: string): Promise<string | null> => {
    try {
      const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
      if (!info.exists) return null;
      return await FileSystem.readAsStringAsync(SETTINGS_PATH);
    } catch {
      return null;
    }
  },
  setItem: async (_key: string, value: string): Promise<void> => {
    await FileSystem.writeAsStringAsync(SETTINGS_PATH, value);
  },
  removeItem: async (_key: string): Promise<void> => {
    const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
    if (info.exists) await FileSystem.deleteAsync(SETTINGS_PATH);
  },
}));

interface SettingsState extends AppSettings {
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      triggerRadiusM: 50,
      distanceUnit: 'km',
      theme: 'auto',
      penaltyPerMissMs: 5 * 60 * 1000, // 5 minutes
      updateSettings: (partial: Partial<AppSettings>) => set((s) => ({ ...s, ...partial })),
    }),
    {
      name: 'app-settings',
      storage: expoFileStorage,
    },
  ),
);
