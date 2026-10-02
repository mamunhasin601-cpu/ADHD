import * as SecureStore from 'expo-secure-store';
import { DEFAULT_ORBITS_THEME_NAME, type OrbitsThemeName } from '../theme/orbits';

export const ORBITS_THEME_STORAGE_KEY = 'focus_orbits_theme';

export function parseOrbitsThemeName(value: unknown): OrbitsThemeName {
  return value === 'warm' || value === 'dark' ? value : DEFAULT_ORBITS_THEME_NAME;
}

export async function loadOrbitsTheme(): Promise<OrbitsThemeName> {
  try {
    return parseOrbitsThemeName(await SecureStore.getItemAsync(ORBITS_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_ORBITS_THEME_NAME;
  }
}

export async function saveOrbitsTheme(themeName: OrbitsThemeName): Promise<void> {
  await SecureStore.setItemAsync(ORBITS_THEME_STORAGE_KEY, themeName);
}
