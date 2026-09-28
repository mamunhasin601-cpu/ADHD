import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { getActiveTaskConflict, getEarlyStartConflict, useStartTask } from './tasks';
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

  it('switches with an explicit body, heals the conflicted row without reopening completed history, and invalidates all task views', async () => {
    const staleOptimisticCompletion = {
      ...task('old', new Date('2026-08-14T09:00:00Z')),
      completedAt: new Date('2026-08-14T10:01:00Z'),
    };
    const completedHistory = {
      ...task('done', new Date('2026-08-14T08:00:00Z')),
      completedAt: new Date('2026-08-14T08:30:00Z'),
    };
    const server = task('target', canonicalStart);
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: server });
    const ctx = setup();
    const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
    ctx.client.setQueryData(['tasks', '2026-08-14'], [staleOptimisticCompletion, completedHistory, task('target')]);
    await act(async () => {
      await ctx.result.current.mutateAsync({ id: 'target', activeTaskId: 'old', confirmSwitch: true });
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/tasks/target/start', { confirmSwitch: true });
    expect(ctx.client.getQueryData<any[]>(['tasks', '2026-08-14'])).toEqual([
      expect.objectContaining({ id: 'old', startedAt: null, completedAt: null }),
      completedHistory,
      server,
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    ctx.cleanup();
  });

  it('sends independent early-start confirmation and both confirmations together', async () => {
    const server = task('target', canonicalStart);
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: server });
    const ctx = setup();
    await act(async () => {
      await ctx.result.current.mutateAsync({ id: 'target', confirmEarlyStart: true });
      await ctx.result.current.mutateAsync({
        id: 'target',
        confirmEarlyStart: true,
        confirmSwitch: true,
      });
    });
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      1,
      '/tasks/target/start',
      { confirmEarlyStart: true },
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      '/tasks/target/start',
      { confirmSwitch: true, confirmEarlyStart: true },
    );
    ctx.cleanup();
  });

  it('parses only the typed active-task conflict', () => {
    const conflict = { code: 'ACTIVE_TASK_CONFLICT', message: 'conflict', activeTask: { id: 'old', title: 'Old', startedAt: canonicalStart } };
    expect(getActiveTaskConflict({ response: { status: 409, data: conflict } })).toEqual(conflict);
    expect(getActiveTaskConflict({ response: { status: 409, data: { message: 'completed' } } })).toBeNull();
    expect(getActiveTaskConflict({ response: { status: 500, data: conflict } })).toBeNull();
  });

  it('parses only the typed early-start conflict with scheduled metadata', () => {
    const conflict = {
      code: 'EARLY_START_CONFIRMATION_REQUIRED',
      message: 'early',
      scheduledTask: { id: 'future', title: 'Future', startTime: '2026-09-28T23:15:00.000Z' },
    };
    expect(getEarlyStartConflict({ response: { status: 409, data: conflict } })).toEqual(conflict);
    expect(getEarlyStartConflict({ response: { status: 409, data: { ...conflict, scheduledTask: { id: 'future' } } } })).toBeNull();
    expect(getEarlyStartConflict({ response: { status: 500, data: conflict } })).toBeNull();
  });
});
