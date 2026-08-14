/**
 * RootLayout permission lifecycle integration tests (Task 0011D).
 *
 * Tests the AppState-driven notification permission transitions through the
 * production component/module boundaries. All external dependencies are mocked;
 * the RootLayout component itself is the real production code under test.
 *
 * Acceptance boundaries proven:
 *   1. granted → revoked: local-fallback selected, reminders reconciled, no new prompt.
 *   2. denied → granted: device registered, remote-primary restored, bounded query sent.
 *   3. Rapid resume events: isHandlingTransition guard prevents overlapping calls.
 *   4. No-change resume: no side effects when permission state hasn't changed.
 *   5. Task CRUD independence: reconcile failure does not crash component.
 *   6. Tap listener cleanup: subscription removed on unmount.
 */

// ── Module mocks (hoisted before imports) ──────────────────────────────────

const mockRouterReplace = jest.fn();
const mockRouterNavigate = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  function MockStack({ children }: { children?: React.ReactNode }) {
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'root-stack' }, children ?? null);
  }
  MockStack.Screen = function MockScreen() { return null; };
  return {
    Stack: MockStack,
    useRouter: jest.fn(() => ({ navigate: mockRouterNavigate, replace: mockRouterReplace })),
    useSegments: jest.fn(() => ['(tabs)', 'today']),
    useRootNavigationState: jest.fn(() => ({ key: 'root-navigation' })),
  };
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../lib/local-notifications', () => ({
  setLocalOnlyMode: jest.fn(),
  reconcileLocalReminders: jest.fn(),
  LOCAL_REMINDER_HORIZON_DAYS: 7,
}));

jest.mock('../lib/notification-permission', () => ({
  requestNotificationPermissionOnce: jest.fn(),
  refreshPermissionState: jest.fn(),
}));

jest.mock('../components/NotificationPermissionBanner', () => ({
  NotificationPermissionBanner: function MockBanner(props: any) {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, {
      testID: 'notification-permission-banner',
      ...props,
    });
  },
}));

// ── Imports ────────────────────────────────────────────────────────────────

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import RootLayout from '../app/_layout';
import { useAuthStore } from '../stores/auth.store';
import { apiClient } from '../lib/api-client';
import { setLocalOnlyMode, reconcileLocalReminders } from '../lib/local-notifications';
import {
  requestNotificationPermissionOnce,
  refreshPermissionState,
} from '../lib/notification-permission';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useSegments } from 'expo-router';

// ── Test fixtures ──────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'layout-test-user',
  email: 'layout@test.com',
  timezone: 'Europe/Moscow',
  hasCompletedOnboarding: true,
  plan: 'FREE' as const,
  phone: null,
  proExpiresAt: null,
  createdAt: new Date('2026-01-01'),
};

const EXPO_TOKEN = 'ExponentPushToken[layout-test-device]';

// ── Shared test state ──────────────────────────────────────────────────────

/** Tracks the latest AppState 'change' handler registered by the component. */
let capturedAppStateHandler: ((s: string) => Promise<void>) | null = null;

/** Simulates the app returning to foreground. */
async function simulateAppResume(): Promise<void> {
  await act(async () => {
    await capturedAppStateHandler?.('active');
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  capturedAppStateHandler = null;
  (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'today']);
  (useRootNavigationState as jest.Mock).mockReturnValue({ key: 'root-navigation' });

  // Capture AppState listener — always updates to the latest registered handler.
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, handler: any) => {
    if (event === 'change') capturedAppStateHandler = handler;
    return { remove: jest.fn() } as any;
  });

  // Auth store: authenticated user available immediately.
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
    selector({
      user: MOCK_USER,
      isAuthenticated: true,
      isLoading: false,
      bootstrap: jest.fn().mockResolvedValue(undefined),
    }),
  );

  // Default: permission granted, push token available.
  (requestNotificationPermissionOnce as jest.Mock).mockResolvedValue('granted');
  (refreshPermissionState as jest.Mock).mockResolvedValue('granted');
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: EXPO_TOKEN });

  // API: token registration succeeds, task fetch returns empty list.
  (apiClient.post as jest.Mock).mockResolvedValue({});
  (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

  // Local notifications: side-effect helpers are no-ops by default.
  (setLocalOnlyMode as jest.Mock).mockImplementation(() => {});
  (reconcileLocalReminders as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Helper: render and wait for initial bootstrap to settle ────────────────

/** Renders RootLayout and waits for the initial push registration to complete. */
async function renderAndSettle(
  initialPermResult: 'granted' | 'denied' = 'granted',
): Promise<ReturnType<typeof render>> {
  (requestNotificationPermissionOnce as jest.Mock).mockResolvedValue(initialPermResult);

  const result = render(<RootLayout />);

  if (initialPermResult === 'granted') {
    // reconcileLocalReminders is the LAST side effect of runPushRegistration.
    // Waiting on setLocalOnlyMode instead would return while the mount-path
    // transition guard is still held, causing simulateAppResume() to be
    // silently dropped by the guard.
    await waitFor(() => {
      expect(reconcileLocalReminders).toHaveBeenCalledWith([], false);
    });
  } else {
    // Denied: runPushRegistration returns early, so there is no reconcile call.
    // The second AppState registration proves React processed the state update
    // and re-ran the effect, so the captured handler closes over 'denied'
    // rather than the initial null (Task 0011E finding 2).
    await waitFor(() => {
      expect(AppState.addEventListener).toHaveBeenCalledTimes(2);
    });
  }

  // Flush the fire-and-forget mount registration promise so its finally block
  // releases the transition guard before any test simulates a resume event.
  await act(async () => {});

  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RootLayout — initial bootstrap', () => {
  it('blocks protected content while bootstrap is unresolved', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        bootstrap: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { getByTestId } = render(<RootLayout />);

    expect(getByTestId('root-stack')).toBeTruthy();
    expect(getByTestId('auth-bootstrap-loading')).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('mounts the root navigator before performing the auth redirect', async () => {
    (useRootNavigationState as jest.Mock).mockReturnValue(undefined);
    (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'today']);
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        bootstrap: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { getByTestId, rerender } = render(<RootLayout />);

    expect(getByTestId('root-stack')).toBeTruthy();
    expect(getByTestId('auth-bootstrap-loading')).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    (useRootNavigationState as jest.Mock).mockReturnValue({ key: 'root-navigation' });
    rerender(<RootLayout />);

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/login'));
    rerender(<RootLayout />);
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
  });

  it.each([
    [['(tabs)', 'today'], '/login'],
    [['task-form'], '/login'],
  ])('redirects unauthenticated protected route %p to %s', async (segments, target) => {
    (useSegments as jest.Mock).mockReturnValue(segments);
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        bootstrap: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { getByTestId } = render(<RootLayout />);

    expect(getByTestId('root-stack')).toBeTruthy();
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith(target));
  });

  it('does not redirect unauthenticated Login route back onto itself', () => {
    (useSegments as jest.Mock).mockReturnValue(['login']);
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        bootstrap: jest.fn().mockResolvedValue(undefined),
      }),
    );

    const { getByTestId, queryByTestId } = render(<RootLayout />);

    expect(getByTestId('root-stack')).toBeTruthy();
    expect(queryByTestId('auth-bootstrap-loading')).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('granted: registers device and selects remote-primary channel', async () => {
    await renderAndSettle('granted');

    // Expo push token obtained.
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);

    // Token posted to the server (ownership-safe endpoint).
    expect(apiClient.post).toHaveBeenCalledWith('/notifications/devices', {
      token: EXPO_TOKEN,
      platform: expect.stringMatching(/^(apns|fcm|expo)$/),
    });

    // Remote-primary channel selected.
    expect(setLocalOnlyMode).toHaveBeenCalledWith(false);

    // Bounded bootstrap query with scheduledFrom/scheduledTo.
    expect(apiClient.get).toHaveBeenCalledWith('/tasks', {
      params: expect.objectContaining({
        includeSubTasks: false,
        scheduledFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        scheduledTo: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    });

    // Reconcile with remote-primary (localOnly=false).
    expect(reconcileLocalReminders).toHaveBeenCalledWith([], false);
  });

  it('denied: no token registration, no channel policy set, no reconcile', async () => {
    await renderAndSettle('denied');

    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(setLocalOnlyMode).not.toHaveBeenCalled();
    expect(reconcileLocalReminders).not.toHaveBeenCalled();
  });

  it('denied: banner is visible when permission denied', async () => {
    const { queryByTestId } = await renderAndSettle('denied');

    // Banner component is rendered.
    expect(queryByTestId('notification-permission-banner')).toBeTruthy();
  });

  it('granted: banner is not shown when permission granted', async () => {
    const { queryByTestId } = await renderAndSettle('granted');

    expect(queryByTestId('notification-permission-banner')).toBeNull();
  });
});

describe('RootLayout — granted → revoked on app resume', () => {
  it('cancels owned reminders, claims no working channel, shows banner', async () => {
    const { queryByTestId } = await renderAndSettle('granted');

    // Initial state verified: remote-primary active.
    expect(setLocalOnlyMode).toHaveBeenLastCalledWith(false);
    jest.clearAllMocks();

    // OS revokes permission while app is backgrounded.
    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');

    await simulateAppResume();

    // 1. All Focus-owned reminders cancelled, none rescheduled.
    //    localOnly=false makes reconcile cancel-only. Passing true here would
    //    schedule local notifications that CANNOT fire, because expo local
    //    notifications need the same OS permission that was just revoked.
    expect(reconcileLocalReminders).toHaveBeenCalledWith([], false);

    // 2. Channel flag set to false — NOT local-fallback(true). With permission
    //    revoked neither push nor local can deliver, so claiming local-fallback
    //    would be false. false is load-bearing: mutation hooks read
    //    getLocalOnlyMode(), and false makes scheduleLocalReminder cancel-and-return
    //    instead of creating local reminders that can never display.
    expect(setLocalOnlyMode).toHaveBeenCalledWith(false);
    expect(setLocalOnlyMode).not.toHaveBeenCalledWith(true);

    // 3. No task query needed — nothing is being rescheduled.
    expect(apiClient.get).not.toHaveBeenCalled();

    // 4. No new permission prompt shown (no loop).
    expect(requestNotificationPermissionOnce).not.toHaveBeenCalled();

    // 5. Banner appears after revocation.
    await waitFor(() => {
      expect(queryByTestId('notification-permission-banner')).toBeTruthy();
    });
  });

  it('regression: revocation never schedules a reminder that cannot fire', async () => {
    await renderAndSettle('granted');
    jest.clearAllMocks();

    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');
    // Even if a task fetch were attempted and returned upcoming work...
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: [{ id: 'task-1', startTime: new Date(Date.now() + 3_600_000), completedAt: null }],
  startedAt: null, firstStep: null,
    });

    await simulateAppResume();

    // ...no reconcile call may ever pass localOnly=true on the revoke path,
    // and no non-empty task list may be scheduled.
    const scheduledWithLocalOnly = (reconcileLocalReminders as jest.Mock).mock.calls.filter(
      ([tasks, localOnly]) => localOnly === true || (Array.isArray(tasks) && tasks.length > 0),
    );
    expect(scheduledWithLocalOnly).toEqual([]);
  });
});

describe('RootLayout — denied → granted on app resume', () => {
  it('re-registers device, restores remote-primary, sends bounded query', async () => {
    await renderAndSettle('denied');
    jest.clearAllMocks();

    // User enabled notifications in OS settings.
    (refreshPermissionState as jest.Mock).mockResolvedValue('granted');
    (requestNotificationPermissionOnce as jest.Mock).mockResolvedValue('granted');
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: EXPO_TOKEN });
    (apiClient.post as jest.Mock).mockResolvedValue({});
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    await simulateAppResume();

    // 1. Permission re-checked (via runPushRegistration).
    expect(requestNotificationPermissionOnce).toHaveBeenCalledTimes(1);

    // 2. Push token registered (device re-registered).
    expect(apiClient.post).toHaveBeenCalledWith('/notifications/devices', {
      token: EXPO_TOKEN,
      platform: expect.stringMatching(/^(apns|fcm|expo)$/),
    });

    // 3. Remote-primary channel restored.
    expect(setLocalOnlyMode).toHaveBeenCalledWith(false);

    // 4. Bounded bootstrap query sent.
    expect(apiClient.get).toHaveBeenCalledWith('/tasks', {
      params: expect.objectContaining({
        scheduledFrom: expect.any(String),
        scheduledTo: expect.any(String),
      }),
    });

    // 5. Reconcile with remote-primary (localOnly=false).
    expect(reconcileLocalReminders).toHaveBeenCalledWith([], false);
  });
});

describe('RootLayout — no-change resume', () => {
  it('granted state unchanged: no side effects on resume', async () => {
    await renderAndSettle('granted');
    jest.clearAllMocks();

    // Permission unchanged.
    (refreshPermissionState as jest.Mock).mockResolvedValue('granted');

    await simulateAppResume();

    // No registration, no channel change, no reconcile.
    expect(setLocalOnlyMode).not.toHaveBeenCalled();
    expect(reconcileLocalReminders).not.toHaveBeenCalled();
    expect(requestNotificationPermissionOnce).not.toHaveBeenCalled();
  });

  it('denied state unchanged: no side effects on resume', async () => {
    await renderAndSettle('denied');
    jest.clearAllMocks();

    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');

    await simulateAppResume();

    expect(setLocalOnlyMode).not.toHaveBeenCalled();
    expect(reconcileLocalReminders).not.toHaveBeenCalled();
    expect(requestNotificationPermissionOnce).not.toHaveBeenCalled();
  });
});

describe('RootLayout — rapid resume guard', () => {
  it('second active event while first is in progress is dropped', async () => {
    await renderAndSettle('granted');
    jest.clearAllMocks();

    // Make reconcile slow so the first handler is still in progress.
    let resolveFirstReconcile!: () => void;
    (reconcileLocalReminders as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((res) => { resolveFirstReconcile = res; }),
    );
    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    // Start first event (not awaited — processing in background).
    const first = capturedAppStateHandler?.('active');

    // Second event fires before first completes.
    await act(async () => {
      await capturedAppStateHandler?.('active');
    });

    // Resolve the first event.
    await act(async () => {
      resolveFirstReconcile?.();
      await first;
    });

    // reconcileLocalReminders should have been called exactly once
    // (second event was dropped by isHandlingTransition guard).
    expect(reconcileLocalReminders).toHaveBeenCalledTimes(1);
  });
});

describe('RootLayout — mount-path guard', () => {
  it('resume during in-flight mount registration does not run overlapping paths', async () => {
    // Hold the mount registration open at its last step so the mount path is
    // provably still in flight when the resume event arrives.
    let releaseMountReconcile!: () => void;
    (reconcileLocalReminders as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((res) => { releaseMountReconcile = res; }),
    );

    render(<RootLayout />);

    // Wait until mount registration has reached its final step (still pending).
    await waitFor(() => {
      expect(reconcileLocalReminders).toHaveBeenCalledTimes(1);
    });

    // Permission changed while mount registration is mid-flight.
    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');

    // Fire a resume event now. The mount path holds the guard, so this must be
    // dropped rather than racing on channel policy / reconciliation.
    await act(async () => {
      await capturedAppStateHandler?.('active');
    });

    // The dropped event must not have started a transition: no second reconcile
    // and no permission refresh, because the guard is taken before the first await.
    expect(reconcileLocalReminders).toHaveBeenCalledTimes(1);
    expect(refreshPermissionState).not.toHaveBeenCalled();

    // Release the mount path and let it settle.
    await act(async () => {
      releaseMountReconcile?.();
    });
  });
});

describe('RootLayout — listener lifecycle', () => {
  it('tap listener subscription is removed on unmount', async () => {
    const removeSpy = jest.fn();
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: removeSpy,
    });

    const { unmount } = render(<RootLayout />);
    await act(async () => {});

    unmount();

    expect(removeSpy).toHaveBeenCalled();
  });

  it('AppState handler re-registers when notifPermState changes', async () => {
    // Initial render registers handler (notifPermState=null).
    render(<RootLayout />);

    // Wait for initial registration.
    await waitFor(() => expect(AppState.addEventListener).toHaveBeenCalledTimes(1));

    // After permission check completes, state changes → second registration.
    await waitFor(() => expect(AppState.addEventListener).toHaveBeenCalledTimes(2));
  });

  it('handler ignores non-active AppState events', async () => {
    await renderAndSettle('granted');
    jest.clearAllMocks();

    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');

    // Fire background and inactive events — should not trigger any side effect.
    await act(async () => {
      await capturedAppStateHandler?.('background');
      await capturedAppStateHandler?.('inactive');
    });

    expect(setLocalOnlyMode).not.toHaveBeenCalled();
    expect(reconcileLocalReminders).not.toHaveBeenCalled();
  });
});

describe('RootLayout — task CRUD independence', () => {
  it('reconcile failure after revocation does not crash the component', async () => {
    const { queryByTestId } = await renderAndSettle('granted');
    jest.clearAllMocks();

    (refreshPermissionState as jest.Mock).mockResolvedValue('denied');
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('network'));
    // Both reconcile calls fail.
    (reconcileLocalReminders as jest.Mock).mockRejectedValue(new Error('local storage error'));

    // Component must not throw even when all secondary effects fail.
    await expect(simulateAppResume()).resolves.not.toThrow();

    // Component remains mounted and functional.
    expect(queryByTestId('notification-permission-banner')).toBeTruthy();
  });

  it('push registration failure falls back to local-fallback gracefully', async () => {
    await renderAndSettle('denied');
    jest.clearAllMocks();

    (refreshPermissionState as jest.Mock).mockResolvedValue('granted');
    (requestNotificationPermissionOnce as jest.Mock).mockResolvedValue('granted');
    // Token fetch fails.
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
      new Error('no project id'),
    );
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

    await simulateAppResume();

    // Falls back to local-fallback when push registration fails.
    expect(setLocalOnlyMode).toHaveBeenCalledWith(true);
    // Reconcile still runs with local-fallback.
    expect(reconcileLocalReminders).toHaveBeenCalledWith([], true);
  });
});
