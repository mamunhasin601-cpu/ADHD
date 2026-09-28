import { render } from '@testing-library/react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Index from '../app/index';
import FocusScreen from '../app/(tabs)/focus';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../theme/orbits';

jest.mock('expo-status-bar', () => ({
  StatusBar: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'route-status-bar', ...props });
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('remaining Phase B route canvases', () => {
  it.each(['warm', 'dark'] as const)('themes the index transition canvas in %s', (name) => {
    const view = render(<OrbitsThemeProvider theme={name}><Index /></OrbitsThemeProvider>);
    const theme = ORBITS_THEMES[name];
    expect(StyleSheet.flatten(view.getByTestId('index-screen').props.style).backgroundColor).toBe(theme.background);
    expect(view.UNSAFE_getByType(ActivityIndicator).props.color).toBe(theme.brand);
    expect(view.getByTestId('route-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');
  });

  it.each(['warm', 'dark'] as const)('themes the production-addressable Focus placeholder in %s', (name) => {
    const view = render(<OrbitsThemeProvider theme={name}><FocusScreen /></OrbitsThemeProvider>);
    const theme = ORBITS_THEMES[name];
    expect(StyleSheet.flatten(view.getByTestId('focus-screen').props.style).backgroundColor).toBe(theme.background);
    expect(StyleSheet.flatten(view.getByText('Фокус-комнаты').props.style).color).toBe(theme.textPrimary);
    expect(StyleSheet.flatten(view.getByText(/Body doubling/).props.style).color).toBe(theme.textSecondary);
    expect(view.getByTestId('route-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');
  });
});
