import React, { StrictMode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-notifications', () => ({ getExpoPushTokenAsync: jest.fn() }));
jest.mock('./api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('./local-notifications', () => ({
  LOCAL_REMINDER_HORIZON_DAYS: 7,
  reconcileLocalReminders: jest.fn(),
  setLocalOnlyMode: jest.fn(),
}));
jest.mock('./notification-permission', () => ({
  deferNotificationInvitation: jest.fn(),
  getInvitationDisposition: jest.fn(),
  inspectNotificationPermission: jest.fn(),
  openNotificationSettings: jest.fn(),
  refreshPermissionState: jest.fn(),
  requestNotificationPermissionExplicitly: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import { apiClient } from './api-client';
import { reconcileLocalReminders, setLocalOnlyMode } from './local-notifications';
import {
  deferNotificationInvitation,
  getInvitationDisposition,
  inspectNotificationPermission,
  refreshPermissionState,
  requestNotificationPermissionExplicitly,
} from './notification-permission';
import { NotificationLifecycleProvider, useNotificationLifecycle } from './notification-lifecycle';

const inspect = inspectNotificationPermission as jest.Mock;
const request = requestNotificationPermissionExplicitly as jest.Mock;
const refresh = refreshPermissionState as jest.Mock;
const getInvitation = getInvitationDisposition as jest.Mock;
const token = Notifications.getExpoPushTokenAsync as jest.Mock;
const post = apiClient.post as jest.Mock;
const getTasks = apiClient.get as jest.Mock;
const reconcile = reconcileLocalReminders as jest.Mock;
const setMode = setLocalOnlyMode as jest.Mock;
let appStateHandler: ((state: string) => void) | null;

function Probe() {
  const value = useNotificationLifecycle();
  return <View>
    <Text testID="permission">{value.permission ?? 'unknown'}</Text>
    <Text testID="invitation">{value.invitation ?? 'unknown'}</Text>
    <Text testID="error">{value.error ?? ''}</Text>
    <Text testID="busy">{String(value.busy)}</Text>
    <Pressable testID="request" onPress={value.requestPermission} />
    <Pressable testID="defer" onPress={value.deferInvitation} />
  </View>;
}

function Harness({ userId, strict = false }: { userId?: string; strict?: boolean }) {
  const tree = <NotificationLifecycleProvider userId={userId}><Probe /></NotificationLifecycleProvider>;
  return strict ? <StrictMode>{tree}</StrictMode> : tree;
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  appStateHandler = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
    appStateHandler = handler;
    return { remove: jest.fn() } as any;
  });
  getInvitation.mockResolvedValue('available');
  inspect.mockResolvedValue('not-asked');
  request.mockResolvedValue('granted');
  refresh.mockResolvedValue('granted');
  token.mockResolvedValue({ data: 'ExponentPushToken[test]' });
  post.mockResolvedValue({});
  getTasks.mockResolvedValue({ data: [] });
  reconcile.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

async function settlePermission(expected: string) {
  await waitFor(() => expect(screen.getByTestId('permission').props.children).toBe(expected));
}

it('keeps fresh askable bootstrap not-asked without a native request or registration', async () => {
  render(<Harness userId="A" />);
  await settlePermission('not-asked');
  expect(request).not.toHaveBeenCalled();
  expect(token).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
});

it('bootstraps an existing grant with exactly one bounded remote-primary reconciliation', async () => {
  inspect.mockResolvedValue('granted');
  const { rerender } = render(<Harness userId="A" />);
  await waitFor(() => expect(reconcile).toHaveBeenCalledWith([], false));
  expect(token).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledTimes(1);
  expect(getTasks).toHaveBeenCalledWith('/tasks', { params: expect.objectContaining({ includeSubTasks: false, scheduledFrom: expect.any(String), scheduledTo: expect.any(String) }) });
  rerender(<Harness userId="A" />);
  await act(async () => {});
  expect(post).toHaveBeenCalledTimes(1);
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it('performs no registration for stored denial', async () => {
  inspect.mockResolvedValue('denied');
  render(<Harness userId="A" />);
  await settlePermission('denied');
  expect(token).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
});

it('coalesces rapid explicit presses and grant registers and reconciles once', async () => {
  const pending = deferred<'granted'>();
  request.mockReturnValue(pending.promise);
  render(<Harness userId="A" />);
  await settlePermission('not-asked');
  fireEvent.press(screen.getByTestId('request'));
  fireEvent.press(screen.getByTestId('request'));
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve('granted'));
  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledTimes(1);
});

it('denied explicit request registers and reconciles nothing', async () => {
  request.mockResolvedValue('denied');
  render(<Harness userId="A" />);
  await settlePermission('not-asked');
  fireEvent.press(screen.getByTestId('request'));
  await settlePermission('denied');
  expect(post).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
});

it('uses local fallback when push registration fails while permission is granted', async () => {
  inspect.mockResolvedValue('granted');
  token.mockRejectedValue(new Error('unavailable'));
  render(<Harness userId="A" />);
  await waitFor(() => expect(reconcile).toHaveBeenCalledWith([], true));
  expect(setMode).toHaveBeenCalledWith(true);
});

it('granted to revoked cancels owned reminders without false local fallback', async () => {
  inspect.mockResolvedValue('granted');
  refresh.mockResolvedValue('denied');
  render(<Harness userId="A" />);
  await waitFor(() => expect(reconcile).toHaveBeenCalledWith([], false));
  jest.clearAllMocks();
  await act(async () => appStateHandler?.('active'));
  await settlePermission('denied');
  expect(setMode).toHaveBeenCalledWith(false);
  expect(setMode).not.toHaveBeenCalledWith(true);
  expect(reconcile).toHaveBeenCalledWith([], false);
  expect(getTasks).not.toHaveBeenCalled();
});

it('denied to granted on resume registers and reconciles exactly once', async () => {
  inspect.mockResolvedValue('denied');
  refresh.mockResolvedValue('granted');
  render(<Harness userId="A" />);
  await settlePermission('denied');
  await act(async () => appStateHandler?.('active'));
  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledTimes(1);
});

it('unchanged grant resume has no secondary effects', async () => {
  inspect.mockResolvedValue('granted');
  render(<Harness userId="A" />);
  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  jest.clearAllMocks();
  await act(async () => appStateHandler?.('active'));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
});

it('coalesces concurrent active events and active during bootstrap', async () => {
  const pending = deferred<'granted'>();
  inspect.mockReturnValue(pending.promise);
  render(<Harness userId="A" />);
  await act(async () => { appStateHandler?.('active'); appStateHandler?.('active'); });
  expect(inspect).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => pending.resolve('granted'));
  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
});

it('registers once for each authenticated owner without sending a user id payload', async () => {
  inspect.mockResolvedValue('granted');
  const { rerender } = render(<Harness userId="A" />);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  rerender(<Harness />);
  await act(async () => {});
  rerender(<Harness userId="B" />);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(reconcile).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[1][1]).not.toHaveProperty('userId');
  rerender(<Harness userId="B" />);
  await act(async () => {});
  expect(post).toHaveBeenCalledTimes(2);
});

it('invalidates User A while token is pending so only User B completes', async () => {
  inspect.mockResolvedValue('granted');
  const oldToken = deferred<{ data: string }>();
  token.mockReturnValueOnce(oldToken.promise).mockResolvedValueOnce({ data: 'B-token' });
  const { rerender } = render(<Harness userId="A" />);
  await waitFor(() => expect(token).toHaveBeenCalledTimes(1));
  rerender(<Harness userId="B" />);
  await waitFor(() => expect(token).toHaveBeenCalledTimes(2));
  await act(async () => oldToken.resolve({ data: 'A-token' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith('/notifications/devices', expect.objectContaining({ token: 'B-token' }));
  expect(setMode).toHaveBeenCalledTimes(1);
  expect(getTasks).toHaveBeenCalledTimes(1);
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it('stale device POST settlement cannot set channel policy or reconcile', async () => {
  inspect.mockResolvedValue('granted');
  const oldPost = deferred<{}>();
  post.mockReturnValueOnce(oldPost.promise).mockResolvedValueOnce({});
  const { rerender } = render(<Harness userId="A" />);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  rerender(<Harness userId="B" />);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  await act(async () => oldPost.resolve({}));
  expect(setMode).toHaveBeenCalledTimes(1);
  expect(getTasks).toHaveBeenCalledTimes(1);
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it('clears a prior inspection error after a successful current retry', async () => {
  inspect.mockRejectedValueOnce(new Error('inspect')).mockResolvedValueOnce('not-asked');
  render(<Harness userId="A" />);
  await waitFor(() => expect(screen.getByTestId('error').props.children).toContain('Не удалось'));
  await act(async () => appStateHandler?.('active'));
  await settlePermission('not-asked');
  expect(screen.getByTestId('error').props.children).toBe('');
});

it('delayed hydration cannot overwrite a newer deferral', async () => {
  const hydration = deferred<'available'>();
  getInvitation.mockReturnValue(hydration.promise);
  render(<Harness userId="A" />);
  fireEvent.press(screen.getByTestId('defer'));
  await act(async () => hydration.resolve('available'));
  expect(screen.getByTestId('invitation').props.children).toBe('deferred');
  expect(deferNotificationInvitation).toHaveBeenCalledTimes(1);
});

it('StrictMode cleanup and unmount invalidate old hydration and registration without warnings', async () => {
  const hydration = deferred<'available'>();
  const pendingToken = deferred<{ data: string }>();
  getInvitation.mockReturnValue(hydration.promise);
  inspect.mockResolvedValue('granted');
  token.mockReturnValue(pendingToken.promise);
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { unmount } = render(<Harness userId="A" strict />);
  await waitFor(() => expect(token).toHaveBeenCalled());
  unmount();
  await act(async () => { hydration.resolve('available'); pendingToken.resolve({ data: 'stale' }); });
  expect(post).not.toHaveBeenCalled();
  expect(setMode).not.toHaveBeenCalled();
  expect(reconcile).not.toHaveBeenCalled();
  expect(errorSpy).not.toHaveBeenCalled();
});
