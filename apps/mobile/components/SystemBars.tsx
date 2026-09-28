import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import type { OrbitsThemeTokens } from '../theme/orbits';

export function SystemBars({ theme }: { theme: OrbitsThemeTokens }) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    const apply = async () => {
      await Promise.all([
        NavigationBar.setBackgroundColorAsync(theme.background),
        NavigationBar.setBorderColorAsync(theme.borderSubtle),
        NavigationBar.setButtonStyleAsync(theme.name === 'dark' ? 'light' : 'dark'),
      ]);
    };
    void apply().catch(() => {
      // Unsupported vendor/system-bar modes must not interrupt navigation.
      void active;
    });
    return () => {
      active = false;
    };
  }, [theme.background, theme.borderSubtle, theme.name]);

  return (
    <StatusBar
      animated
      backgroundColor={theme.background}
      style={theme.name === 'dark' ? 'light' : 'dark'}
      translucent={false}
    />
  );
}
