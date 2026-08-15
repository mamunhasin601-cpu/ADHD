import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react'); const { View } = require('react-native');
  const Stack = ({ children }: any) => React.createElement(View, { testID: 'stack' }, children);
  Stack.Screen = () => null;
  return { Stack, useRouter: () => ({ replace: mockReplace, navigate: jest.fn() }), useSegments: () => ['(tabs)', 'today'], useRootNavigationState: () => ({ key: 'nav' }) };
});
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })) }));
const mockLifecycle = { permission: 'not-asked', invitation: 'available', busy: false, error: null, requestPermission: jest.fn(), deferInvitation: jest.fn(), openSettings: jest.fn() };
jest.mock('../lib/notification-lifecycle', () => ({
  NotificationLifecycleProvider: ({ children }: any) => children,
  useNotificationLifecycle: () => mockLifecycle,
}));
jest.mock('../stores/auth.store', () => ({ useAuthStore: jest.fn() }));
import RootLayout from '../app/_layout';
import { useAuthStore } from '../stores/auth.store';

beforeEach(() => { jest.clearAllMocks(); });

it('does not request notification permission during authenticated bootstrap', () => {
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ user: { id: 'u', hasCompletedOnboarding: true }, isAuthenticated: true, isLoading: false, bootstrap: jest.fn() }));
  render(<RootLayout />);
  expect(mockLifecycle.requestPermission).not.toHaveBeenCalled();
});

it('keeps the auth loading overlay independent from notifications', () => {
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ user: null, isAuthenticated: false, isLoading: true, bootstrap: jest.fn() }));
  const { getByTestId } = render(<RootLayout />);
  expect(getByTestId('auth-bootstrap-loading')).toBeTruthy();
  expect(mockLifecycle.requestPermission).not.toHaveBeenCalled();
});

it('shows recovery only for actual denied permission', async () => {
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ user: { id: 'u' }, isAuthenticated: true, isLoading: false, bootstrap: jest.fn() }));
  mockLifecycle.permission = 'denied';
  const { getByText } = render(<RootLayout />);
  await waitFor(() => expect(getByText(/Уведомления выключены/)).toBeTruthy());
  mockLifecycle.permission = 'not-asked';
});
