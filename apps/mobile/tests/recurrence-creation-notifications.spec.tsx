jest.mock('../lib/api-client', () => ({ apiClient: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('../lib/local-notifications', () => ({
  scheduleLocalReminder: jest.fn().mockResolvedValue(undefined), cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  reconcileLocalReminders: jest.fn().mockResolvedValue(undefined), getLocalOnlyMode: jest.fn(), LOCAL_REMINDER_HORIZON_DAYS: 7,
}));
import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCreateTask, useUpdateTask } from '../lib/api/tasks';
import { apiClient } from '../lib/api-client';
import { cancelLocalReminder, getLocalOnlyMode, reconcileLocalReminders } from '../lib/local-notifications';
import { useAuthStore } from '../stores/auth.store';

const wrapperFor = (client: QueryClient) => ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const strictWrapperFor = (client: QueryClient) => ({ children }: PropsWithChildren) => (
  <React.StrictMode><QueryClientProvider client={client}>{children}</QueryClientProvider></React.StrictMode>
);
const series = { id: 'series', isRecurring: true, startTime: '2026-08-15T09:00:00Z', completedAt: null, startedAt: null, newOccurrenceIds: ['o1'] };

describe('recurrence mobile notification lifecycle', () => {
  beforeEach(() => { jest.clearAllMocks(); useAuthStore.setState({ user: { id: 'A' } as any, sessionGeneration: 1 }); });

  it.each([true, false])('reconciles concrete occurrences immediately after creation (localOnly=%s)', async (localOnly) => {
    (getLocalOnlyMode as jest.Mock).mockReturnValue(localOnly);
    (apiClient.post as jest.Mock).mockResolvedValue({ data: series });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [{ id: 'o1', startTime: '2026-08-16T09:00:00Z' }] });
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = renderHook(() => useCreateTask(new Date(), 'UTC'), { wrapper: wrapperFor(client) });
    await act(async () => { await result.current.mutateAsync({ title: 'R', startTime: '2026-08-15T09:00:00Z', isRecurring: true, recurrenceRule: 'FREQ=DAILY' }); });
    expect(reconcileLocalReminders).toHaveBeenCalledWith(expect.any(Array), localOnly, expect.any(Function));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    unmount(); client.clear();
  });

  it('keeps the live StrictMode continuation after replay and performs current success effects', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { ...series, isRecurring: false, newOccurrenceIds: [] } });
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const hook = renderHook(() => useCreateTask(new Date('2026-08-17T12:00:00Z'), 'UTC'), {
      wrapper: strictWrapperFor(client),
    });

    await act(async () => { await hook.result.current.mutateAsync({ title: 'Strict' }); });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: expect.any(Array) }));
    hook.unmount();
    client.clear();
  });

  it('invalidates A -> logout -> A even when the user id is unchanged', async () => {
    let release!: () => void; (cancelLocalReminder as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...series, affectedOccurrenceIds: ['old1', 'old2'] } });
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }); const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = renderHook(() => useUpdateTask(new Date(), 'UTC'), { wrapper: wrapperFor(client) });
    const pending = result.current.mutateAsync({ id: 'old1', dto: { title: 'N' } });
    await waitFor(() => expect(cancelLocalReminder).toHaveBeenCalledWith('old1'));
    await act(async () => { useAuthStore.setState({ user: null, sessionGeneration: 2 }); useAuthStore.setState({ user: { id: 'A' } as any, sessionGeneration: 3 }); release(); await pending; });
    expect(cancelLocalReminder).toHaveBeenCalledTimes(1); expect(invalidate).not.toHaveBeenCalled();
    unmount(); client.clear();
  });

  it('stops after unmount and lets a second mutation supersede the first', async () => {
    let release!: () => void; (cancelLocalReminder as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...series, affectedOccurrenceIds: ['old'] } });
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }); const invalidate = jest.spyOn(client, 'invalidateQueries');
    const hook = renderHook(() => useUpdateTask(new Date(), 'UTC'), { wrapper: wrapperFor(client) });
    const first = hook.result.current.mutateAsync({ id: 'old', dto: { title: '1' } }); await waitFor(() => expect(cancelLocalReminder).toHaveBeenCalled());
    const second = hook.result.current.mutateAsync({ id: 'old', dto: { title: '2' } }); hook.unmount(); release(); await Promise.all([first, second]);
    expect(invalidate).not.toHaveBeenCalled(); client.clear();
  });

  it('drops stale reconciliation after an awaited GET when session changes to B', async () => {
    let release!: (value: any) => void; (apiClient.get as jest.Mock).mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...series, affectedOccurrenceIds: ['old'] } });
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } });
    const hook = renderHook(() => useUpdateTask(new Date(), 'UTC'), { wrapper: wrapperFor(client) });
    const pending = hook.result.current.mutateAsync({ id: 'old', dto: { title: 'N' } }); await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    await act(async () => { useAuthStore.setState({ user: { id: 'B' } as any, sessionGeneration: 2 }); release({ data: [] }); await pending; });
    expect(reconcileLocalReminders).not.toHaveBeenCalled(); hook.unmount(); client.clear();
  });
});
