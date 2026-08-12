jest.mock('../lib/api-client', () => ({
  apiClient: { post: jest.fn() },
}));
jest.mock('../lib/local-notifications', () => ({
  scheduleLocalReminder: jest.fn().mockResolvedValue(undefined),
  cancelLocalReminder: jest.fn().mockResolvedValue(undefined),
  getLocalOnlyMode: jest.fn(() => false),
}));

import React, { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useCreateTask } from '../lib/api/tasks';
import { apiClient } from '../lib/api-client';

describe('useCreateTask', () => {
  it('posts the task and invalidates the matching Today query', async () => {
    const mockPost = apiClient.post as jest.Mock;
    const task = { id: 'task-1', title: 'Новая задача', startTime: null, completedAt: null };
    mockPost.mockResolvedValue({ data: task });
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { gcTime: 0 },
      },
    });
    const invalidateSpy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () => useCreateTask(new Date('2026-08-11T12:00:00.000Z'), 'Europe/Moscow'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ title: 'Новая задача', startTime: null });
    });

    expect(mockPost).toHaveBeenCalledWith('/tasks', {
      title: 'Новая задача',
      startTime: null,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks', '2026-08-11'] });
    unmount();
    queryClient.clear();
  });
});
