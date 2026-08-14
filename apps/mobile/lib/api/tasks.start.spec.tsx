import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useStartTask } from './tasks';
import { apiClient } from '../api-client';
import { cancelLocalReminder } from '../local-notifications';

jest.mock('../api-client', () => ({ apiClient: { patch: jest.fn() } }));
jest.mock('../local-notifications', () => ({
  cancelLocalReminder: jest.fn(), scheduleLocalReminder: jest.fn(), getLocalOnlyMode: jest.fn(() => true),
}));

const originalStart = new Date('2026-08-14T10:00:00Z');
const canonicalStart = new Date('2026-08-14T10:03:19.123Z');
const task = (id: string, startedAt: Date | null = null) => ({
  id, userId: 'user', title: id, startTime: originalStart, durationMinutes: 30,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt, createdAt: new Date(), updatedAt: new Date(),
});

function setup(date = new Date('2026-08-14T12:00:00Z'), timezone = 'UTC') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useStartTask(date, timezone), { wrapper });
  return { client, ...hook, cleanup: () => { hook.unmount(); client.clear(); } };
}

describe('useStartTask', () => {
  beforeEach(() => jest.clearAllMocks());

  it('replaces only the matching task with the exact server response and cancels its reminder', async () => {
    const server = task('task-1', canonicalStart); const other = task('task-2');
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: server });
    (cancelLocalReminder as jest.Mock).mockResolvedValue(undefined);
    const ctx = setup(); ctx.client.setQueryData(['tasks', '2026-08-14'], [task('task-1'), other]);
    await act(async () => { await ctx.result.current.mutateAsync('task-1'); });
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-1/start');
    const cached = ctx.client.getQueryData<any[]>(['tasks', '2026-08-14'])!;
    expect(cached[0]).toEqual(server); expect(cached[0].startedAt).toBe(canonicalStart);
    expect(cached[0].startTime).toBe(originalStart); expect(cached[1]).toEqual(other);
    expect(cancelLocalReminder).toHaveBeenCalledWith('task-1'); ctx.cleanup();
  });

  it('isolates local reminder cancellation failure without reverting or rejecting start', async () => {
    const server = task('task-1', canonicalStart);
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: server });
    (cancelLocalReminder as jest.Mock).mockRejectedValue(new Error('local unavailable'));
    const ctx = setup(); ctx.client.setQueryData(['tasks', '2026-08-14'], [task('task-1')]);
    await act(async () => { await expect(ctx.result.current.mutateAsync('task-1')).resolves.toEqual(server); });
    expect(ctx.client.getQueryData(['tasks', '2026-08-14'])).toEqual([server]); ctx.cleanup();
  });

  it.each([500, 503])('leaves cache unchanged for generic API failure %s', async (status) => {
    (apiClient.patch as jest.Mock).mockRejectedValue({ response: { status } });
    const ctx = setup(); const before = [task('task-1'), task('task-2')];
    ctx.client.setQueryData(['tasks', '2026-08-14'], before);
    await act(async () => { await expect(ctx.result.current.mutateAsync('task-1')).rejects.toMatchObject({ response: { status } }); });
    expect(ctx.client.getQueryData(['tasks', '2026-08-14'])).toEqual(before); ctx.cleanup();
  });

  it('invalidates the correct profile-timezone canonical cache on 409', async () => {
    (apiClient.patch as jest.Mock).mockRejectedValue({ response: { status: 409 } });
    const ctx = setup(new Date('2026-08-14T22:00:00Z'), 'Europe/Moscow');
    const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
    await act(async () => { await expect(ctx.result.current.mutateAsync('task-1')).rejects.toMatchObject({ response: { status: 409 } }); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', '2026-08-15'] }); ctx.cleanup();
  });
});
