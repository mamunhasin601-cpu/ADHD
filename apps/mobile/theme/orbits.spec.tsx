import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { contrastRatio, DEFAULT_ORBITS_THEME_NAME, ORBITS_THEMES, OrbitsThemeProvider, useOrbitsTheme } from './orbits';

describe('Orbits themes', () => {
  it('uses warm by default and preserves the approved backgrounds', () => {
    expect(DEFAULT_ORBITS_THEME_NAME).toBe('warm');
    expect(ORBITS_THEMES.warm.background).toBe('#FCF9F6');
    expect(ORBITS_THEMES.gray.background).toBe('#8B8E96');
    expect(ORBITS_THEMES.dark.background).toBe('#211D2E');
  });

  it('keeps navigation labels readable', () => {
    expect(ORBITS_THEMES.dark.navigationLabel).toBe('#FFFFFF');
    expect(contrastRatio(ORBITS_THEMES.gray.navigationLabel, ORBITS_THEMES.gray.background)).toBeGreaterThanOrEqual(4.5);
    for (const theme of Object.values(ORBITS_THEMES)) {
      expect(contrastRatio(theme.navigationLabel, theme.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps semantic Today text and state accents distinguishable', () => {
    for (const theme of Object.values(ORBITS_THEMES)) {
      expect(contrastRatio(theme.textPrimary, theme.surfacePrimary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.errorPrimary, theme.errorSoft)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('resolves an explicit override deterministically without external state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <OrbitsThemeProvider theme="dark">{children}</OrbitsThemeProvider>;
    const { result } = renderHook(() => useOrbitsTheme(), { wrapper });
    expect(result.current).toBe(ORBITS_THEMES.dark);
  });
});
