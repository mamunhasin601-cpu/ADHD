jest.mock('../lib/api-client', () => ({
  apiClient: { delete: jest.fn() },
}));
jest.mock('../lib/local-notifications', () => ({
  scheduleLocalReminder: jest.fn().mockResolvedValue(undefined),
  cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  getLocalOnlyMode: jest.fn(() => false),
}));

import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useDeleteTask } from '../lib/api/tasks';
import { apiClient } from '../lib/api-client';

describe('useDeleteTask', () => {
  it('removes a successfully deleted task from the visible date cache before resolving', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({ status: 204 });
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
});
