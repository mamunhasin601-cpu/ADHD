import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SystemBars } from './SystemBars';
import { ORBITS_THEMES } from '../theme/orbits';

jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
  setBorderColorAsync: jest.fn().mockResolvedValue(undefined),
  setButtonStyleAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: any) => require('react').createElement('StatusBar', { testID: 'system-status-bar', ...props }),
}));

describe('SystemBars', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('reacts to warm and dark theme tokens for both Android system bars', async () => {
    const view = render(<SystemBars theme={ORBITS_THEMES.warm} />);
    expect(view.getByTestId('system-status-bar').props).toMatchObject({
      backgroundColor: ORBITS_THEMES.warm.background,
      style: 'dark',
      translucent: false,
    });
    await waitFor(() => expect(NavigationBar.setButtonStyleAsync).toHaveBeenLastCalledWith('dark'));

    view.rerender(<SystemBars theme={ORBITS_THEMES.dark} />);
    expect(view.getByTestId('system-status-bar').props).toMatchObject({
      backgroundColor: ORBITS_THEMES.dark.background,
      style: 'light',
    });
    await waitFor(() => {
      expect(NavigationBar.setBackgroundColorAsync).toHaveBeenLastCalledWith(ORBITS_THEMES.dark.background);
      expect(NavigationBar.setButtonStyleAsync).toHaveBeenLastCalledWith('light');
    });
  });
});
