import { create } from 'zustand';
import { DEFAULT_ORBITS_THEME_NAME, type OrbitsThemeName } from '../theme/orbits';
import { loadOrbitsTheme, saveOrbitsTheme } from '../lib/orbits-theme-storage';

export const ORBITS_THEME_SAVE_ERROR = 'Не удалось сохранить оформление. Попробуйте ещё раз.';

type OrbitsThemeState = {
  themeName: OrbitsThemeName;
  hydrated: boolean;
  saving: boolean;
  saveError: string | null;
  bootstrap: () => Promise<void>;
  selectTheme: (themeName: OrbitsThemeName) => Promise<boolean>;
};

let bootstrapPromise: Promise<void> | null = null;
let savePending = false;

export const useOrbitsThemeStore = create<OrbitsThemeState>((set, get) => ({
  themeName: DEFAULT_ORBITS_THEME_NAME,
  hydrated: false,
  saving: false,
  saveError: null,
  bootstrap: async () => {
    if (get().hydrated) return;
    if (!bootstrapPromise) {
      bootstrapPromise = loadOrbitsTheme()
        .then((themeName) => set({ themeName, hydrated: true }))
        .catch(() => set({ themeName: DEFAULT_ORBITS_THEME_NAME, hydrated: true }));
    }
    await bootstrapPromise;
  },
  selectTheme: async (themeName) => {
    if (savePending || themeName === get().themeName) return false;
    savePending = true;
    set({ saving: true, saveError: null });
    try {
      await saveOrbitsTheme(themeName);
      set({ themeName });
      return true;
    } catch {
      set({ saveError: ORBITS_THEME_SAVE_ERROR });
      return false;
    } finally {
      savePending = false;
      set({ saving: false });
    }
  },
}));

export function resetOrbitsThemeStoreForTests() {
  bootstrapPromise = null;
  savePending = false;
  useOrbitsThemeStore.setState({
    themeName: DEFAULT_ORBITS_THEME_NAME,
    hydrated: false,
    saving: false,
    saveError: null,
  });
}
