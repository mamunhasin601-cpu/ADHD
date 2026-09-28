import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useToggleTask } from './tasks';
import { apiClient } from '../api-client';

jest.mock('../api-client', () => ({ apiClient: { patch: jest.fn() } }));
jest.mock('../local-notifications', () => ({
  cancelLocalReminder: jest.fn(() => Promise.resolve()),
  scheduleLocalReminder: jest.fn(() => Promise.resolve()),
  getLocalOnlyMode: jest.fn(() => true),
}));

const openTask = {
  id: 'future', userId: 'owner', title: 'Future', startTime: new Date('2026-09-28T23:15:00Z'),
  durationMinutes: 30, color: '#6B5BFC', isRecurring: false, recurrenceRule: null,
  parentTaskId: null, completedAt: null, startedAt: null, createdAt: new Date(), updatedAt: new Date(),
};

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useToggleTask(new Date('2026-09-28T17:56:00Z'), 'UTC'), { wrapper });
  client.setQueryData(['tasks', '2026-09-28'], [openTask]);
  return { client, ...hook, cleanup: () => { hook.unmount(); client.clear(); } };
}

describe('useToggleTask canonical completion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not paint completion before a non-optimistic confirmed response', async () => {
    let resolve!: (value: unknown) => void;
    (apiClient.patch as jest.Mock).mockReturnValue(new Promise((done) => { resolve = done; }));
    const ctx = setup();

    let request!: Promise<unknown>;
    act(() => {
      request = ctx.result.current.mutateAsync({ id: 'future', optimistic: false });
    });
    await act(async () => Promise.resolve());
    expect(ctx.client.getQueryData<any[]>(['tasks', '2026-09-28'])![0].completedAt).toBeNull();

    const completed = { ...openTask, completedAt: new Date('2026-09-28T17:57:00Z') };
    await act(async () => {
      resolve({ data: completed });
      await request;
    });
    expect(ctx.client.getQueryData(['tasks', '2026-09-28'])).toEqual([completed]);
    ctx.cleanup();
  });

  it('keeps the original cache on confirmed completion failure', async () => {
    (apiClient.patch as jest.Mock).mockRejectedValue(new Error('offline'));
    const ctx = setup();
    await act(async () => {
      await expect(ctx.result.current.mutateAsync({ id: 'future', optimistic: false })).rejects.toThrow('offline');
    });
    expect(ctx.client.getQueryData(['tasks', '2026-09-28'])).toEqual([openTask]);
    ctx.cleanup();
  });
});
