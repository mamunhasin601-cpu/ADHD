jest.mock('../lib/api-client', () => ({
  apiClient: { delete: jest.fn(), patch: jest.fn(), post: jest.fn(), get: jest.fn().mockResolvedValue({ data: [] }) },
  getAuthTokens: jest.fn(),
  setAuthTokens: jest.fn(),
}));
jest.mock('../lib/secure-storage', () => ({
  saveTokens: jest.fn().mockResolvedValue(undefined),
  loadTokens: jest.fn(),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/local-notifications', () => ({
  scheduleLocalReminder: jest.fn().mockResolvedValue(undefined),
  cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  getLocalOnlyMode: jest.fn(() => false),
  reconcileLocalReminders: jest.fn().mockResolvedValue(undefined),
  LOCAL_REMINDER_HORIZON_DAYS: 7,
}));

import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  useCreateTask,
  useDeleteTask,
  useRescheduleOverdueTasks,
  useUndoRecovery,
  useUpdateTask,
} from '../lib/api/tasks';
import { apiClient } from '../lib/api-client';
import { cancelLocalReminder } from '../lib/local-notifications';
import { useAuthStore } from '../stores/auth.store';

describe('useDeleteTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      sessionGeneration: 0,
    });
  });
  it('removes a successfully deleted task from the visible date cache before resolving', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({ status: 200, data: { affectedOccurrenceIds: ['deleted-task'] } });
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 60_000 },
      },
    });
    const dateKey = ['tasks', '2026-08-11'];
    queryClient.setQueryData(dateKey, [
      { id: 'deleted-task', title: 'Deleted task' },
      { id: 'remaining-task', title: 'Remaining task' },
    ]);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () => useDeleteTask(new Date('2026-08-11T12:00:00.000Z'), 'Europe/Moscow'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync('deleted-task');
    });

    expect(apiClient.delete).toHaveBeenCalledWith('/tasks/deleted-task');
    expect(queryClient.getQueryData(dateKey)).toEqual([
      { id: 'remaining-task', title: 'Remaining task' },
    ]);

    unmount();
    queryClient.clear();
  });

  it('cancels every affected occurrence and invalidates all dated caches', async () => {
    useAuthStore.setState({ user: { id: 'owner' } as any });
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { affectedOccurrenceIds: ['occ-1', 'occ-2'] } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }); const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(['tasks', '2026-08-11'], [{ id: 'occ-1' }]);
    queryClient.setQueryData(['tasks', '2026-08-12'], [{ id: 'occ-2' }]);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useDeleteTask(new Date('2026-08-11T12:00:00Z'), 'UTC'), { wrapper });
    await act(async () => { await result.current.mutateAsync('occ-1'); });
    expect(cancelLocalReminder).toHaveBeenCalledWith('occ-1'); expect(cancelLocalReminder).toHaveBeenCalledWith('occ-2');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    unmount(); queryClient.clear();
  });

  it('keeps the successful delete lifecycle alive across token rotation', async () => {
    useAuthStore.setState({
      user: { id: 'owner' } as any,
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      isAuthenticated: true,
      sessionGeneration: 17,
    });
    let resolveDelete!: (value: { data: { affectedOccurrenceIds: string[] } }) => void;
    (apiClient.delete as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 }, mutations: { retry: false, gcTime: 0 } },
    });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const dateKey = ['tasks', '2026-08-11'];
    queryClient.setQueryData(dateKey, [{ id: 'deleted-task' }, { id: 'remaining-task' }]);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(
      () => useDeleteTask(new Date('2026-08-11T12:00:00.000Z'), 'UTC'),
      { wrapper },
    );

    const onSuccess = jest.fn();
    let pending!: Promise<{ affectedOccurrenceIds: string[] }>;
    act(() => { pending = result.current.mutateAsync('deleted-task', { onSuccess }); });
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/tasks/deleted-task'));
    await act(async () => {
      await useAuthStore.getState().setTokens({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });
    expect(useAuthStore.getState().sessionGeneration).toBe(17);

    let resolved: { affectedOccurrenceIds: string[] } | undefined;
    await act(async () => {
      resolveDelete({ data: { affectedOccurrenceIds: ['deleted-task'] } });
      resolved = await pending;
    });

    expect(resolved).toEqual({ affectedOccurrenceIds: ['deleted-task'] });
    expect(queryClient.getQueryData(dateKey)).toEqual([{ id: 'remaining-task' }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unmount(); queryClient.clear();
  });

  it('stops awaited cleanup and cache work when lifecycle ownership changes', async () => {
    useAuthStore.setState({ user: { id: 'owner' } as any });
    let release!: () => void; (cancelLocalReminder as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { affectedOccurrenceIds: ['occ-1', 'occ-2'] } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }); const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useDeleteTask(new Date(), 'UTC'), { wrapper });
    const pending = result.current.mutateAsync('occ-1');
    await waitFor(() => expect(cancelLocalReminder).toHaveBeenCalledWith('occ-1'));
    await act(async () => { useAuthStore.setState({ user: { id: 'other' } as any }); release(); await pending; });
    expect(cancelLocalReminder).toHaveBeenCalledTimes(1); expect(invalidate).not.toHaveBeenCalled();
    unmount(); queryClient.clear();
  });

  it('series edit cleans stale local occurrence reminders and invalidates every date', async () => {
    useAuthStore.setState({ user: { id: 'owner' } as any });
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 'series', isRecurring: true, affectedOccurrenceIds: ['old-1', 'old-2'] } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }); const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useUpdateTask(new Date(), 'UTC'), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: 'old-1', dto: { title: 'New' } }); });
    expect(cancelLocalReminder).toHaveBeenCalledWith('old-1'); expect(cancelLocalReminder).toHaveBeenCalledWith('old-2');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    unmount(); queryClient.clear();
  });

  it.each([
    {
      name: 'create',
      hook: () => useCreateTask(new Date('2026-08-11T12:00:00.000Z'), 'UTC'),
      method: 'post' as const,
      variables: { title: 'Created' },
      response: { id: 'created', isRecurring: false, startTime: null, completedAt: null, startedAt: null },
      expectedKeys: [['tasks', '2026-08-11'], ['tasks', 'inbox']],
    },
    {
      name: 'update',
      hook: () => useUpdateTask(new Date('2026-08-11T12:00:00.000Z'), 'UTC'),
      method: 'patch' as const,
      variables: { id: 'updated', dto: { title: 'Updated' } },
      response: { id: 'updated', isRecurring: false, startTime: null, completedAt: null, startedAt: null },
      expectedKeys: [['tasks'], ['tasks', 'inbox']],
    },
    {
      name: 'Recovery reschedule',
      hook: () => useRescheduleOverdueTasks(new Date('2026-08-11T12:00:00.000Z'), 'UTC'),
      method: 'post' as const,
      variables: { items: [{ taskId: 'recovered', targetStartTime: null }] },
      response: { undoId: 'undo-1', tasks: [] },
      expectedKeys: [['tasks', 'recovery', '2026-08-11'], ['tasks', '2026-08-11'], ['tasks', 'inbox']],
    },
    {
      name: 'Recovery undo',
      hook: () => useUndoRecovery(new Date('2026-08-11T12:00:00.000Z'), 'UTC'),
      method: 'post' as const,
      variables: 'undo-1',
      response: { tasks: [] },
      expectedKeys: [['tasks', '2026-08-11'], ['tasks', 'inbox'], ['tasks', 'recovery', '2026-08-11'], ['tasks']],
    },
  ])('$name keeps its success lifecycle across token rotation', async ({ hook, method, variables, response, expectedKeys }) => {
    useAuthStore.setState({
      user: { id: 'owner' } as any,
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      isAuthenticated: true,
      sessionGeneration: 23,
    });
    let resolveRequest!: (value: { data: typeof response }) => void;
    (apiClient[method] as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(hook as () => any, { wrapper });

    let pending!: Promise<unknown>;
    act(() => { pending = (result.current as any).mutateAsync(variables); });
    await waitFor(() => expect(apiClient[method]).toHaveBeenCalled());
    await act(async () => {
      await useAuthStore.getState().setTokens({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });
    expect(useAuthStore.getState().sessionGeneration).toBe(23);
    await act(async () => {
      resolveRequest({ data: response });
      await expect(pending).resolves.toBe(response);
    });

    for (const queryKey of expectedKeys) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unmount(); queryClient.clear();
  });
});
