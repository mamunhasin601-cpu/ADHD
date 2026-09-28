import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { login } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import LoginScreen from '../app/login';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../theme/orbits';

const mockAuthenticate = jest.fn();

jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }));
jest.mock('../lib/api/auth', () => ({ login: jest.fn() }));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: any) => selector({ authenticate: mockAuthenticate }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});
jest.mock('expo-status-bar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { StatusBar: (props: any) => React.createElement(View, { testID: 'login-status-bar', ...props }) };
});

describe('LoginScreen', () => {
  it('keeps the keyboard layout scrollable inside the safe area', () => {
    render(<OrbitsThemeProvider theme="warm"><LoginScreen /></OrbitsThemeProvider>);
    expect(screen.getByTestId('login-scroll').props).toMatchObject({
      keyboardShouldPersistTaps: 'handled',
      contentInsetAdjustmentBehavior: 'automatic',
      automaticallyAdjustKeyboardInsets: true,
    });
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an app-owned themed error dialog without exposing raw login details', async () => {
    (login as jest.Mock).mockRejectedValue(new Error('secret server detail'));
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Пароль'), 'password');
    fireEvent.press(screen.getByText('Войти'));

    expect(await screen.findByText('Не удалось войти')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('secret server detail')).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it.each(['warm', 'dark'] as const)('uses %s tokens before authentication', (name) => {
    render(<OrbitsThemeProvider theme={name}><LoginScreen /></OrbitsThemeProvider>);
    const theme = ORBITS_THEMES[name];
    expect(StyleSheet.flatten(screen.getByTestId('login-screen').props.style).backgroundColor).toBe(theme.background);
    expect(StyleSheet.flatten(screen.getByPlaceholderText('you@example.com').props.style)).toMatchObject({
      backgroundColor: theme.surfacePrimary,
      borderColor: theme.borderSubtle,
      color: theme.textPrimary,
    });
    expect(screen.getByPlaceholderText('you@example.com').props.placeholderTextColor).toBe(theme.textSecondary);
    expect(screen.getByTestId('login-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');
  });
});
