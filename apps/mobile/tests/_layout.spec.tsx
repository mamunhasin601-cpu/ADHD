import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
let mockSegments: string[] = ['(tabs)', 'today'];
let mockNavigationState: { key: string } | undefined = { key: 'nav' };
let mockTapHandler: ((response: any) => void) | null = null;
const mockTapRemove = jest.fn();
const mockThemeBootstrap = jest.fn();
let mockThemeState: {
  themeName: 'warm' | 'dark';
  hydrated: boolean;
  bootstrap: typeof mockThemeBootstrap;
} = { themeName: 'warm', hydrated: true, bootstrap: mockThemeBootstrap };

jest.mock('expo-router', () => {
  const React = require('react'); const { View } = require('react-native');
  const Stack = ({ children, ...props }: any) => React.createElement(View, { testID: 'stack', ...props }, children);
  Stack.Screen = ({ name, options }: any) => React.createElement(View, { testID: `stack-screen-${name}`, options });
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace, navigate: mockNavigate }),
    useSegments: () => mockSegments,
    useRootNavigationState: () => mockNavigationState,
  };
});
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((handler) => {
    mockTapHandler = handler;
    return { remove: mockTapRemove };
  }),
}));
const mockLifecycle = { permission: 'not-asked', invitation: 'available', busy: false, error: null, requestPermission: jest.fn(), deferInvitation: jest.fn(), openSettings: jest.fn() };
jest.mock('../lib/notification-lifecycle', () => ({
  NotificationLifecycleProvider: ({ children }: any) => children,
  useNotificationLifecycle: () => mockLifecycle,
}));
jest.mock('../stores/auth.store', () => ({ useAuthStore: jest.fn() }));
jest.mock('../stores/orbits-theme.store', () => ({
  useOrbitsThemeStore: (selector: any) => selector(mockThemeState),
}));
jest.mock('../lib/device-timezone-sync', () => ({ DeviceTimezoneSync: () => null }));

import RootLayout from '../app/_layout';
import { useAuthStore } from '../stores/auth.store';
import { ORBITS_THEMES } from '../theme/orbits';

const authenticated = { user: { id: 'u', hasCompletedOnboarding: true }, isAuthenticated: true, isLoading: false, bootstrap: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockSegments = ['(tabs)', 'today'];
  mockNavigationState = { key: 'nav' };
  mockLifecycle.permission = 'not-asked';
  mockTapHandler = null;
  mockThemeState = { themeName: 'warm', hydrated: true, bootstrap: mockThemeBootstrap };
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector(authenticated));
});

it('keeps auth bootstrap independent and never invokes the explicit notification action', () => {
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ user: null, isAuthenticated: false, isLoading: true, bootstrap: jest.fn() }));
  const { getByTestId } = render(<RootLayout />);
  expect(getByTestId('auth-bootstrap-loading')).toBeTruthy();
  expect(mockLifecycle.requestPermission).not.toHaveBeenCalled();
});

it('mounts the navigator before redirecting and de-duplicates the redirect', async () => {
  mockNavigationState = undefined;
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ user: null, isAuthenticated: false, isLoading: false, bootstrap: jest.fn() }));
  const view = render(<RootLayout />);
  expect(view.getByTestId('stack')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  mockNavigationState = { key: 'nav' };
  view.rerender(<RootLayout />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  view.rerender(<RootLayout />);
  expect(mockReplace).toHaveBeenCalledTimes(1);
});

it('shows recovery only for an authenticated actual denial and hides it on logout', () => {
  mockLifecycle.permission = 'denied';
  const view = render(<RootLayout />);
  expect(view.getByTestId('notification-permission-banner')).toBeTruthy();
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ user: null, isAuthenticated: false, isLoading: false, bootstrap: jest.fn() }));
  mockSegments = ['login'];
  view.rerender(<RootLayout />);
  expect(view.queryByTestId('notification-permission-banner')).toBeNull();
});

it('does not show recovery for not-asked or deferred installation state', () => {
  mockLifecycle.permission = 'not-asked';
  const view = render(<RootLayout />);
  expect(view.queryByTestId('notification-permission-banner')).toBeNull();
});

it('routes safe task-reminder taps to Today and ignores unrelated payloads', () => {
  render(<RootLayout />);
  act(() => mockTapHandler?.({ notification: { request: { content: { data: { type: 'other' } } } } }));
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => mockTapHandler?.({ notification: { request: { content: { data: { type: 'task-reminder' } } } } }));
  expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/today');
});

it('removes the notification-tap listener on unmount', () => {
  const { unmount } = render(<RootLayout />);
  unmount();
  expect(mockTapRemove).toHaveBeenCalledTimes(1);
});

describe('root theme integration', () => {
  it.each(['warm', 'dark'] as const)('themes the task form header and transition canvas for %s', (name) => {
    mockThemeState = { themeName: name, hydrated: true, bootstrap: mockThemeBootstrap };
    const view = render(<RootLayout />);
    const theme = ORBITS_THEMES[name];
    const screenOptions = view.getByTestId('stack').props.screenOptions;
    const taskFormOptions = view.getByTestId('stack-screen-task-form').props.options;

    expect(screenOptions).toMatchObject({
      headerShown: false,
      contentStyle: { backgroundColor: theme.background },
    });
    expect(taskFormOptions).toMatchObject({
      presentation: 'modal',
      headerShown: true,
      title: 'Задача',
      headerStyle: { backgroundColor: theme.background },
      headerTintColor: theme.textPrimary,
      headerTitleStyle: { color: theme.textPrimary },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: theme.background },
    });
    expect(StyleSheet.flatten(taskFormOptions.headerBackground().props.style)).toMatchObject({
      backgroundColor: theme.background,
      borderBottomColor: theme.borderSubtle,
      borderBottomWidth: StyleSheet.hairlineWidth,
    });
  });

  it('updates Stack and task-form header options reactively', () => {
    const view = render(<RootLayout />);
    expect(view.getByTestId('stack').props.screenOptions.contentStyle.backgroundColor).toBe(ORBITS_THEMES.warm.background);

    mockThemeState = { themeName: 'dark', hydrated: true, bootstrap: mockThemeBootstrap };
    view.rerender(<RootLayout />);

    expect(view.getByTestId('stack').props.screenOptions.contentStyle.backgroundColor).toBe(ORBITS_THEMES.dark.background);
    expect(view.getByTestId('stack-screen-task-form').props.options.headerTintColor).toBe(ORBITS_THEMES.dark.textPrimary);
  });

  it.each(['warm', 'dark'] as const)('uses %s tokens for auth and theme bootstrap overlays', (name) => {
    mockThemeState = { themeName: name, hydrated: false, bootstrap: mockThemeBootstrap };
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      bootstrap: jest.fn(),
    }));
    const view = render(<RootLayout />);
    const theme = ORBITS_THEMES[name];

    for (const testID of ['auth-bootstrap-loading', 'theme-bootstrap-loading']) {
      const overlay = view.getByTestId(testID);
      expect(StyleSheet.flatten(overlay.props.style).backgroundColor).toBe(theme.background);
      expect(overlay.findByType(ActivityIndicator).props.color).toBe(theme.brand);
    }
  });
});
