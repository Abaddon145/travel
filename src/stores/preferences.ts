import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";

type PreferencesState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "lvxu-preferences" },
  ),
);

export function resolveDark(theme: ThemeMode, systemDark: boolean) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemDark;
}
