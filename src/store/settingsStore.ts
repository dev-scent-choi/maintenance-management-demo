import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings, Theme, Language, LayoutType, TableStyle } from '../types/settings';
import { defaultSettings } from '../types/settings';

interface SettingsStore {
  settings: UserSettings;
  updateTheme: (theme: Theme) => void;
  updateLanguage: (language: Language) => void;
  updateLayoutType: (layoutType: LayoutType) => void;
  updateFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
  updateTableStyle: (tableStyle: TableStyle) => void;
  updateCompanyEmail: (companyEmail: string) => void;
  updateNotifications: (key: keyof UserSettings['notifications'], value: boolean) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateTheme: (theme) =>
        set((state) => ({
          settings: { ...state.settings, theme },
        })),

      updateLanguage: (language) =>
        set((state) => ({
          settings: { ...state.settings, language },
        })),

      updateLayoutType: (layoutType) =>
        set((state) => ({
          settings: { ...state.settings, layoutType },
        })),

      updateFontSize: (fontSize) =>
        set((state) => ({
          settings: { ...state.settings, fontSize },
        })),

      updateTableStyle: (tableStyle) =>
        set((state) => ({
          settings: { ...state.settings, tableStyle },
        })),

      updateCompanyEmail: (companyEmail) =>
        set((state) => ({
          settings: { ...state.settings, companyEmail },
        })),

      updateNotifications: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: {
              ...state.settings.notifications,
              [key]: value,
            },
          },
        })),

      resetSettings: () =>
        set({ settings: defaultSettings }),
    }),
    {
      name: 'user-settings',
    }
  )
);
