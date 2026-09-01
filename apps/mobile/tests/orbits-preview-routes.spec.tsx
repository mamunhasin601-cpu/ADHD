import React from 'react';
import { render, screen } from '@testing-library/react-native';
import PlanScreen from '../app/(tabs)/plan';
import ProgressScreen from '../app/(tabs)/progress';
import { OrbitsThemeProvider } from '../theme/orbits';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('Orbits preview destinations', () => {
  it.each([
    ['План', PlanScreen, 'plan-preview-screen'],
    ['Успех', ProgressScreen, 'progress-preview-screen'],
  ] as const)('renders truthful %s preview without fabricated data', (title, Screen, testID) => {
    render(<OrbitsThemeProvider theme="warm"><Screen /></OrbitsThemeProvider>);
    expect(screen.getByTestId(testID)).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText('Раздел уже на месте')).toBeTruthy();
    expect(screen.getByText(/честный preview без выдуманных данных/)).toBeTruthy();
  });
});
