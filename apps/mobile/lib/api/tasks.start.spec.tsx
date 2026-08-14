import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStartTask } from './tasks';
import { apiClient } from '../api-client';
import { cancelLocalReminder } from '../local-notifications';

jest.mock('../api-client', () => ({ apiClient: { patch: jest.fn() } }));
jest.mock('../local-notifications', () => ({
  cancelLocalReminder: jest.fn(), scheduleLocalReminder: jest.fn(),
  getLocalOnlyMode: jest.fn(() => true),
}));

const serverTask = {
  id: 'task-1', userId: 'user', title: 'Task', startTime: new Date('2026-08-14T10:00:00Z'),
  durationMinutes: 30, color: '#6B5BFC', isRecurring: false, recurrenceRule: null,
  parentTaskId: null, completedAt: null, startedAt: new Date('2026-08-14T10:03:19.123Z'),
  createdAt: new Date(), updatedAt: new Date(),
};

describe('useStartTask', () => {
  it('calls the focused endpoint and caches the exact server response while isolating cancellation failure', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: serverTask });
    (cancelLocalReminder as jest.Mock).mockRejectedValue(new Error('local unavailable'));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(['tasks', '2026-08-14'], [{ ...serverTask, startedAt: null }]);
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useStartTask(new Date('2026-08-14T12:00:00Z'), 'UTC'), { wrapper });
    await act(async () => { await result.current.mutateAsync(serverTask.id); });
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-1/start');
    expect((client.getQueryData<any[]>(['tasks', '2026-08-14'])![0])).toEqual(serverTask);
    expect(cancelLocalReminder).toHaveBeenCalledWith(serverTask.id);
    client.clear();
  });

  it('invalidates stale state after a 409 response', async () => {
    (apiClient.patch as jest.Mock).mockRejectedValue({ response: { status: 409 } });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useStartTask(new Date('2026-08-14T12:00:00Z'), 'UTC'), { wrapper });
    act(() => result.current.mutate(serverTask.id));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', '2026-08-14'] });
    client.clear();
  });
});
