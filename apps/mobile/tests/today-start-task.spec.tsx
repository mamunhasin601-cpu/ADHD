const mockPush = jest.fn();
const mockStart = jest.fn();
const mockToggle = jest.fn();
let mockTasks: any[] = [];
let mockStartImplementation: (id: string) => Promise<any>;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => {
  const React = require('react');
  return {
    useTasksForDate: () => ({ data: mockTasks, isLoading: false, isError: false }),
    useCreateTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useToggleTask: () => ({ mutate: mockToggle, isPending: false }),
    useStartTask: () => {
      const [isPending, setPending] = React.useState(false);
      const [, forceRender] = React.useState(0);
      return {
        isPending,
        mutateAsync: async (id: string) => {
          mockStart(id); setPending(true);
          try { return await mockStartImplementation(id); } finally { setPending(false); forceRender((value: number) => value + 1); }
        },
      };
    },
  };
});
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: any) => selector({ user: { timezone: 'UTC', timeFormat: 'H24' } }),
}));
jest.mock('../components/RecoverySection', () => ({ RecoverySection: () => null }));
jest.mock('../components/ProgressRing', () => ({ ProgressRing: () => null }));
jest.mock('../components/timeline/Timeline', () => ({ Timeline: () => null }));
jest.mock('../components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native'); return { SafeAreaView: ({ children }: any) => <View>{children}</View> };
});

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TodayScreen from '../app/(tabs)/today';

const scheduled = (id: string, startTime: string) => ({
  id, userId: 'user', title: `Задача ${id}`, startTime: new Date(startTime), durationMinutes: 30,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, createdAt: new Date(), updatedAt: new Date(),
});

describe('Today explicit task start', () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-14T10:15:00Z')); });
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    jest.clearAllMocks(); mockTasks = [scheduled('current', '2026-08-14T10:00:00Z')];
    mockStartImplementation = async (id) => {
      const server = { ...mockTasks.find((task) => task.id === id), startedAt: new Date('2026-08-14T10:16:27.456Z') };
      mockTasks = mockTasks.map((task) => task.id === id ? server : task); return server;
    };
  });

  it('does not auto-start when scheduled time arrives and starts once with canonical response', async () => {
    const originalStart = mockTasks[0].startTime; render(<TodayScreen />);
    expect(mockStart).not.toHaveBeenCalled(); expect(screen.getByText('Запланировано сейчас')).toBeTruthy();
    expect(screen.getByText('Начать')).toBeTruthy(); expect(screen.queryByText('Завершить')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('Начать')); });
    expect(screen.getByText('Начато')).toBeTruthy();
    expect(mockStart).toHaveBeenCalledTimes(1); expect(mockStart).toHaveBeenCalledWith('current');
    expect(mockTasks[0].startedAt).toEqual(new Date('2026-08-14T10:16:27.456Z'));
    expect(mockTasks[0].startTime).toBe(originalStart); expect(screen.getByText('Завершить')).toBeTruthy();
    fireEvent.press(screen.getByText('Завершить')); expect(mockToggle).toHaveBeenCalledWith('current');
  });

  it('shows explicit start for an upcoming task', () => {
    mockTasks = [scheduled('upcoming', '2026-08-14T11:00:00Z')]; render(<TodayScreen />);
    expect(screen.getByText('Ближайшее действие')).toBeTruthy(); expect(screen.getByText('Начать')).toBeTruthy();
  });

  it('guards rapid duplicates and disables conflicting actions while pending', async () => {
    let resolve!: (value: any) => void; mockStartImplementation = () => new Promise((done) => { resolve = done; });
    render(<TodayScreen />); const button = screen.getByText('Начать');
    fireEvent.press(button); fireEvent.press(button);
    expect(mockStart).toHaveBeenCalledTimes(1); expect(screen.getByText('Начинаю…')).toBeDisabled();
    expect(screen.getByText('Изменить план')).toBeDisabled();
    const server = { ...mockTasks[0], startedAt: new Date('2026-08-14T10:17:00Z') }; mockTasks = [server];
    await act(async () => resolve(server));
  });

  it('keeps task-scoped retryable failure, clears it on success, and never leaks it to task B', async () => {
    mockStartImplementation = async () => { throw new Error('offline'); };
    const view = render(<TodayScreen />); await act(async () => { fireEvent.press(screen.getByText('Начать')); });
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось начать задачу. Проверьте соединение и попробуйте снова.');
    expect(screen.getByText('Начать')).toBeTruthy();
    mockTasks = [scheduled('B', '2026-08-14T10:05:00Z')]; view.rerender(<TodayScreen />);
    expect(screen.queryByRole('alert')).toBeNull();
    mockTasks = [scheduled('current', '2026-08-14T10:00:00Z')]; view.rerender(<TodayScreen />);
    mockStartImplementation = async () => { const server = { ...mockTasks[0], startedAt: new Date('2026-08-14T10:20:00Z') }; mockTasks = [server]; return server; };
    await act(async () => { fireEvent.press(screen.getByText('Начать')); });
    expect(screen.getByText('Начато')).toBeTruthy(); expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not carry errors or render a live Now Card on another selected date', async () => {
    mockStartImplementation = async () => { throw new Error('offline'); }; render(<TodayScreen />);
    await act(async () => { fireEvent.press(screen.getByText('Начать')); }); expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.press(screen.getByText('›'));
    expect(screen.queryByText('Начать')).toBeNull(); expect(screen.queryByRole('alert')).toBeNull();
  });
});
