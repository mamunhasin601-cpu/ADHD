import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { Task } from '@focus/shared-types';
import { useUpdateTask } from './tasks';
import { apiClient } from '../api-client';

jest.mock('../api-client', () => ({ apiClient: { patch: jest.fn(), get: jest.fn() } }));
jest.mock('../local-notifications', () => ({
  cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  scheduleLocalReminder: jest.fn().mockResolvedValue(undefined),
  getLocalOnlyMode: jest.fn(() => true),
  reconcileLocalReminders: jest.fn().mockResolvedValue(undefined),
  LOCAL_REMINDER_HORIZON_DAYS: 30,
}));

const makeTask = (patch: Partial<Task> = {}): Task => ({
  id: 'task-1', userId: 'user', title: 'Прогулка', startTime: new Date('2026-09-12T14:00:00.000Z'),
  durationMinutes: 30, color: '#F59E0B', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
  ...patch,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useUpdateTask(new Date('2026-09-12T12:00:00.000Z'), 'UTC'), { wrapper });
  return { client, ...hook, cleanup: () => { hook.unmount(); client.clear(); } };
}

it('puts the canonical server task into the dated cache before background reconciliation', async () => {
  const before = makeTask();
  const canonical = makeTask({ startTime: null, updatedAt: new Date('2026-09-12T12:01:00.000Z') });
  (apiClient.patch as jest.Mock).mockResolvedValue({ data: canonical });
  const context = setup();
  context.client.setQueryData(['tasks', '2026-09-12'], [before]);

  await act(async () => {
    await context.result.current.mutateAsync({ id: before.id, dto: { startTime: null } });
  });

  expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-1', { startTime: null });
  expect(context.client.getQueryData(['tasks', '2026-09-12'])).toEqual([canonical]);
  context.cleanup();
});
