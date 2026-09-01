import React, { createContext, useContext } from 'react';

export type OrbitsThemeName = 'warm' | 'gray' | 'dark';

export type OrbitsThemeTokens = Readonly<{
  name: OrbitsThemeName;
  background: string;
  textPrimary: string;
  textSecondary: string;
  navigationLabel: string;
  activeSurface: string;
  activeSurfaceText: string;
  activeBorder: string;
  brand: string;
  brandPressed: string;
  borderSubtle: string;
  elevationShadow: string;
  surfacePrimary: string;
  surfaceMuted: string;
  completionPrimary: string;
  completionSoft: string;
  rewardPrimary: string;
  rewardSoft: string;
  timelineNeutral: string;
  errorPrimary: string;
  errorSoft: string;
  retryText: string;
}>;

export const ORBITS_THEMES: Readonly<Record<OrbitsThemeName, OrbitsThemeTokens>> = {
  warm: {
    name: 'warm',
    background: '#FCF9F6',
    textPrimary: '#211D2E',
    textSecondary: '#6B6477',
    navigationLabel: '#211D2E',
    activeSurface: '#F3F1FF',
    activeSurfaceText: '#211D2E',
    activeBorder: '#6B5BFC',
    brand: '#6B5BFC',
    brandPressed: '#5B4BE7',
    borderSubtle: '#DED8E5',
    elevationShadow: '#211D2E',
    surfacePrimary: '#FFFFFF',
    surfaceMuted: '#F7F2EE',
    completionPrimary: '#126F6B',
    completionSoft: '#E2F4F1',
    rewardPrimary: '#8A6500',
    rewardSoft: '#FFF4CC',
    timelineNeutral: '#DED8E5',
    errorPrimary: '#A43B4A',
    errorSoft: '#FBEAEC',
    retryText: '#FFFFFF',
  },
  gray: {
    name: 'gray',
    background: '#E7E7EA',
    textPrimary: '#17151D',
    textSecondary: '#29262F',
    navigationLabel: '#17151D',
    activeSurface: '#F3F1FF',
    activeSurfaceText: '#17151D',
    activeBorder: '#4B3BC7',
    brand: '#6B5BFC',
    brandPressed: '#5B4BE7',
    borderSubtle: '#5F6269',
    elevationShadow: '#17151D',
    surfacePrimary: '#F7F7F8',
    surfaceMuted: '#DADCE0',
    completionPrimary: '#126F6B',
    completionSoft: '#DDF1EE',
    rewardPrimary: '#765700',
    rewardSoft: '#F8EDC6',
    timelineNeutral: '#5F6269',
    errorPrimary: '#8C2F3D',
    errorSoft: '#F7E1E4',
    retryText: '#FFFFFF',
  },
  dark: {
    name: 'dark',
    background: '#211D2E',
    textPrimary: '#FFFFFF',
    textSecondary: '#DDD8E8',
    navigationLabel: '#FFFFFF',
    activeSurface: '#3A324F',
    activeSurfaceText: '#FFFFFF',
    activeBorder: '#AFA6FF',
    brand: '#6B5BFC',
    brandPressed: '#5B4BE7',
    borderSubtle: '#514963',
    elevationShadow: '#000000',
    surfacePrimary: '#2C2739',
    surfaceMuted: '#352F43',
    completionPrimary: '#75D6CF',
    completionSoft: '#243F40',
    rewardPrimary: '#F2D36B',
    rewardSoft: '#463E28',
    timelineNeutral: '#514963',
    errorPrimary: '#FF9AA8',
    errorSoft: '#4B2932',
    retryText: '#FFFFFF',
  },
};

export const DEFAULT_ORBITS_THEME_NAME: OrbitsThemeName = 'warm';

const OrbitsThemeContext = createContext<OrbitsThemeTokens>(ORBITS_THEMES[DEFAULT_ORBITS_THEME_NAME]);

export function OrbitsThemeProvider({ children, theme = DEFAULT_ORBITS_THEME_NAME }: {
  children: React.ReactNode;
  theme?: OrbitsThemeName | OrbitsThemeTokens;
}) {
  const tokens = typeof theme === 'string' ? ORBITS_THEMES[theme] : theme;
  return <OrbitsThemeContext.Provider value={tokens}>{children}</OrbitsThemeContext.Provider>;
}

export function useOrbitsTheme(): OrbitsThemeTokens {
  return useContext(OrbitsThemeContext);
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => linearChannel(parseInt(value.slice(offset, offset + 2), 16)));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
