const mockPush = jest.fn();
const mockStart = jest.fn();
const mockToggle = jest.fn();
const mockUpdate = jest.fn();
let mockTasks: any[] = [];
let mockProfileTimezone = 'UTC';
const mockUseTasksForDate = jest.fn((_date: Date, _timezone?: string | null) => ({
  data: mockTasks,
  isLoading: false,
  isError: false,
}));
let mockStartImplementation: (id: string) => Promise<any>;
let mockUpdateImplementation: (input: { id: string; dto: { firstStep: string } }) => Promise<any>;

let mockInvitationDisposition: 'available' | 'deferred' = 'deferred';
jest.mock("../lib/notification-lifecycle", () => ({ useNotificationLifecycle: () => ({ permission: "not-asked", invitation: mockInvitationDisposition, busy: false, error: null, requestPermission: jest.fn(), deferInvitation: jest.fn(), openSettings: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => {
  const React = require('react');
  return {
    useTasksForDate: (date: Date, timezone?: string | null) =>
      mockUseTasksForDate(date, timezone),
    useCreateTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useUpdateTask: () => {
      const [isPending, setPending] = React.useState(false);
      const [, forceRender] = React.useState(0);
      return {
        isPending,
        mutateAsync: async (input: { id: string; dto: { firstStep: string } }) => {
          mockUpdate(input); setPending(true);
          try { return await mockUpdateImplementation(input); } finally { setPending(false); forceRender((value: number) => value + 1); }
        },
      };
    },
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
  useAuthStore: (selector: any) => selector({ user: { timezone: mockProfileTimezone, timeFormat: 'H24', hasCompletedOnboarding: true } }),
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
import { toCanonicalDateParam } from '../lib/timezone';

const scheduled = (id: string, startTime: string) => ({
  id, userId: 'user', title: `Задача ${id}`, startTime: new Date(startTime), durationMinutes: 30,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
});

describe('Today explicit task start', () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-14T10:15:00Z')); });
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    jest.clearAllMocks(); mockInvitationDisposition = 'deferred'; mockProfileTimezone = 'UTC'; mockTasks = [scheduled('current', '2026-08-14T10:00:00Z')];
    mockStartImplementation = async (id) => {
      const server = { ...mockTasks.find((task) => task.id === id), startedAt: new Date('2026-08-14T10:16:27.456Z') };
      mockTasks = mockTasks.map((task) => task.id === id ? server : task); return server;
    };
    mockUpdateImplementation = async ({ id, dto }) => {
      const server = { ...mockTasks.find((task) => task.id === id), firstStep: dto.firstStep };
      mockTasks = mockTasks.map((task) => task.id === id ? server : task); return server;
    };
  });

  it('selects the Auckland canonical day and renders the onboarding task as the unstarted Now Card', () => {
    const instant = new Date('2026-08-15T12:30:00.000Z');
    jest.setSystemTime(instant);
    mockProfileTimezone = 'Pacific/Auckland';
    mockTasks = [{
      ...scheduled('onboarding', instant.toISOString()),
      title: 'Новый день',
      durationMinutes: null,
      startedAt: null,
    }];

    render(<TodayScreen />);

    const [selectedDate, timezone] = mockUseTasksForDate.mock.calls[0];
    expect(timezone).toBe('Pacific/Auckland');
    expect(toCanonicalDateParam(selectedDate, timezone)).toBe('2026-08-16');
    expect(toCanonicalDateParam(instant, timezone)).toBe('2026-08-16');
    expect(screen.getByText('Новый день')).toBeTruthy();
    expect(screen.getByText('Запланировано сейчас')).toBeTruthy();
    expect(screen.getByText('Начать')).toBeTruthy();
    expect(screen.getByText('Мне трудно начать')).toBeTruthy();
    expect(screen.queryByText('Начато')).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
    mockInvitationDisposition = 'available';
    const invitationView = render(<TodayScreen />);
    expect(invitationView.getByText('Хотите получать напоминания?')).toBeTruthy();

    jest.setSystemTime(new Date('2026-08-14T10:15:00Z'));
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

  it.each(['REST', 'BUFFER'] as const)(
    'ends an unknown-duration current task at a %s boundary and keeps the next task actionable',
    (kind) => {
      mockTasks = [
        { ...scheduled('unknown', '2026-08-14T09:00:00Z'), durationMinutes: null },
        { ...scheduled('block', '2026-08-14T10:00:00Z'), kind },
        scheduled('next', '2026-08-14T12:00:00Z'),
      ];

      render(<TodayScreen />);

      expect(screen.getByText('Ближайшее действие')).toBeTruthy();
      expect(screen.getByText('Задача next')).toBeTruthy();
      expect(screen.queryByText('Задача unknown')).toBeNull();
      expect(screen.queryByText('Задача block')).toBeNull();
    },
  );

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

  it('saves a canonical first step from Today without starting, then closes on canonical start', async () => {
    mockUpdateImplementation = async ({ id }) => {
      const server = { ...mockTasks[0], id, firstStep: 'Канонический шаг Today' };
      mockTasks = [server]; return server;
    };
    render(<TodayScreen />);
    fireEvent.press(screen.getByText('Мне трудно начать'));
    expect(mockUpdate).not.toHaveBeenCalled(); expect(mockStart).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Первый маленький шаг'), 'Черновик Today');
    await act(async () => fireEvent.press(screen.getByText('Сохранить маленький шаг')));
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'current', dto: { firstStep: 'Черновик Today' } });
    expect(screen.getByText('Канонический шаг Today')).toBeTruthy();
    expect(mockStart).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Начать с этого шага')));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Начать с малого')).toBeNull();
    expect(screen.getByText('Начато')).toBeTruthy();
  });

  it('retains Today save failure for retry and guards rapid duplicate saves', async () => {
    let reject!: (error: Error) => void;
    mockUpdateImplementation = () => new Promise((_resolve, fail) => { reject = fail; });
    render(<TodayScreen />); fireEvent.press(screen.getByText('Мне трудно начать'));
    fireEvent.changeText(screen.getByLabelText('Первый маленький шаг'), 'Черновик retry');
    const save = screen.getByText('Сохранить маленький шаг'); fireEvent.press(save); fireEvent.press(save);
    expect(mockUpdate).toHaveBeenCalledTimes(1); expect(screen.getByText('Сохраняю…')).toBeDisabled();
    await act(async () => reject(new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent(/Не удалось сохранить шаг/);
    expect(screen.getByDisplayValue('Черновик retry')).toBeTruthy();
    mockUpdateImplementation = async ({ id }) => { const server = { ...mockTasks[0], id, firstStep: 'Retry canonical' }; mockTasks = [server]; return server; };
    await act(async () => fireEvent.press(screen.getByText('Сохранить маленький шаг')));
    expect(mockUpdate).toHaveBeenCalledTimes(2); expect(screen.getByText('Retry canonical')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull(); expect(mockStart).not.toHaveBeenCalled();
  });

  it('keeps start failure retryable, guards rapid modal start, and scopes support by date', async () => {
    mockTasks = [{ ...mockTasks[0], firstStep: 'Сохранённый шаг' }];
    let reject!: (error: Error) => void;
    mockStartImplementation = () => new Promise((_resolve, fail) => { reject = fail; });
    render(<TodayScreen />); fireEvent.press(screen.getByText('Мне трудно начать'));
    const start = screen.getByText('Начать с этого шага'); fireEvent.press(start); fireEvent.press(start);
    expect(mockStart).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Начать с маленького шага задачу Задача current' })).toBeDisabled();
    await act(async () => reject(new Error('offline')));
    expect(screen.getByText('Сохранённый шаг')).toBeTruthy(); expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.press(screen.getByText('›'));
    expect(screen.queryByText('Начать с малого')).toBeNull(); expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.press(screen.getByText('‹'));
    expect(screen.getByText('Мне трудно начать')).toBeTruthy();
    fireEvent.press(screen.getByText('Мне трудно начать'));
    expect(screen.getByText('Сохранённый шаг')).toBeTruthy();
    mockStartImplementation = async () => { const server = { ...mockTasks[0], startedAt: new Date('2026-08-14T10:30:00Z') }; mockTasks = [server]; return server; };
    await act(async () => fireEvent.press(screen.getByText('Начать с этого шага')));
    expect(mockStart).toHaveBeenCalledTimes(2); expect(screen.getByText('Начато')).toBeTruthy();
  });
});
