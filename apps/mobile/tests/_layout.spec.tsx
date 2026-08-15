import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
let mockSegments: string[] = ['(tabs)', 'today'];
let mockNavigationState: { key: string } | undefined = { key: 'nav' };
let mockTapHandler: ((response: any) => void) | null = null;
const mockTapRemove = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react'); const { View } = require('react-native');
  const Stack = ({ children }: any) => React.createElement(View, { testID: 'stack' }, children);
  Stack.Screen = () => null;
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

import RootLayout from '../app/_layout';
import { useAuthStore } from '../stores/auth.store';

const authenticated = { user: { id: 'u', hasCompletedOnboarding: true }, isAuthenticated: true, isLoading: false, bootstrap: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockSegments = ['(tabs)', 'today'];
  mockNavigationState = { key: 'nav' };
  mockLifecycle.permission = 'not-asked';
  mockTapHandler = null;
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
