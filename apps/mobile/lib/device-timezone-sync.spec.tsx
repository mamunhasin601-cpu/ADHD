import React from 'react';
import { AppState } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../stores/auth.store', () => ({ useAuthStore: jest.fn() }));
jest.mock('./api-client', () => ({
  apiClient: { patch: jest.fn(), get: jest.fn() },
}));
jest.mock('./local-notifications', () => ({
  LOCAL_REMINDER_HORIZON_DAYS: 7,
  getLocalOnlyMode: jest.fn(() => true),
  reconcileLocalReminders: jest.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '../stores/auth.store';
import { apiClient } from './api-client';
import { reconcileLocalReminders } from './local-notifications';
import { DeviceTimezoneSync } from './device-timezone-sync';

let authState: any;
const mockSetUser = jest.fn((user) => { authState = { ...authState, user }; });
const mockUseAuthStore = useAuthStore as unknown as jest.Mock & { getState: jest.Mock };
const mockPatch = apiClient.patch as jest.Mock;
const mockGet = apiClient.get as jest.Mock;
const mockReconcileLocalReminders = reconcileLocalReminders as jest.Mock;

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1', email: 'u@test.dev', phone: null, timezone: 'GMT',
    timezoneSyncedAt: null, timeFormat: 'H24', hasCompletedOnboarding: true,
    plan: 'FREE', proExpiresAt: null, createdAt: new Date(), ...overrides,
  };
}

function renderSync(timezone: string | null = 'Europe/Samara') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={client}>
      <DeviceTimezoneSync resolveTimezone={() => timezone} />
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

describe('DeviceTimezoneSync', () => {
  let appStateHandler: ((state: string) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    authState = {
      user: profile(), isAuthenticated: true, sessionGeneration: 1, setUser: mockSetUser,
    };
    mockUseAuthStore.mockImplementation((selector) => selector(authState));
    mockUseAuthStore.getState = jest.fn(() => authState);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: any) => {
      appStateHandler = handler;
      return { remove: jest.fn() } as any;
    }) as any);
    mockPatch.mockResolvedValue({ data: profile({
      timezone: 'Europe/Samara', timezoneSyncedAt: new Date('2026-09-12T06:40:00Z'),
    }) });
    mockGet.mockResolvedValue({ data: [] });
  });

  afterEach(() => jest.restoreAllMocks());

  it('adopts the smartphone zone, updates auth state and invalidates task caches', async () => {
    const view = renderSync();
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(
      '/users/me/timezone', { timezone: 'Europe/Samara' },
    ));
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: 'Europe/Samara' }),
    ));
    expect(view.invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(mockReconcileLocalReminders).toHaveBeenCalledWith([], true, expect.any(Function));
  });

  it('does no network work when the profile already has the active synced zone', async () => {
    authState.user = profile({
      timezone: 'Europe/Samara', timezoneSyncedAt: new Date('2026-09-01T00:00:00Z'),
    });
    renderSync();
    await act(async () => undefined);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('ignores an invalid device timezone', async () => {
    renderSync(null);
    await act(async () => undefined);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('retries a failed sync on the next foreground event', async () => {
    mockPatch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: profile({
      timezone: 'Europe/Samara', timezoneSyncedAt: new Date(),
    }) });
    renderSync();
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    await act(async () => { appStateHandler?.('active'); });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
  });

  it('ignores a late response after the authenticated session changes', async () => {
    let resolve!: (value: unknown) => void;
    mockPatch.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    renderSync();
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    authState = { ...authState, user: profile({ id: 'u2' }), sessionGeneration: 2 };
    await act(async () => resolve({ data: profile({ timezone: 'Europe/Samara' }) }));
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockReconcileLocalReminders).not.toHaveBeenCalled();
  });
});
