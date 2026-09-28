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
  refetch: jest.fn(),
  isRefetching: false,
}));
let mockStartImplementation: (input: string | { id: string; activeTaskId?: string; confirmSwitch?: boolean; confirmEarlyStart?: boolean }) => Promise<any>;
let mockToggleImplementation: (input: string | { id: string; optimistic?: boolean }) => Promise<any>;
let mockUpdateImplementation: (input: { id: string; dto: { firstStep: string } }) => Promise<any>;

let mockInvitationDisposition: 'available' | 'deferred' = 'deferred';
jest.mock("../lib/notification-lifecycle", () => ({ useNotificationLifecycle: () => ({ permission: "not-asked", invitation: mockInvitationDisposition, busy: false, error: null, requestPermission: jest.fn(), deferInvitation: jest.fn(), openSettings: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => {
  const React = require('react');
  return {
    getActiveTaskConflict: (error: any) => error?.response?.data?.code === 'ACTIVE_TASK_CONFLICT' ? error.response.data : null,
    getEarlyStartConflict: (error: any) => error?.response?.data?.code === 'EARLY_START_CONFIRMATION_REQUIRED' ? error.response.data : null,
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
    useToggleTask: () => {
      const [isPending, setPending] = React.useState(false);
      const [, forceRender] = React.useState(0);
      return {
        isPending,
        mutate: (input: string | { id: string; optimistic?: boolean }) => mockToggle(input),
        mutateAsync: async (input: string | { id: string; optimistic?: boolean }) => {
          mockToggle(input); setPending(true);
          try { return await mockToggleImplementation(input); } finally { setPending(false); forceRender((value: number) => value + 1); }
        },
      };
    },
    useStartTask: () => {
      const [isPending, setPending] = React.useState(false);
      const [, forceRender] = React.useState(0);
      return {
        isPending,
        mutateAsync: async (input: string | { id: string; activeTaskId?: string; confirmSwitch?: boolean; confirmEarlyStart?: boolean }) => {
          mockStart(input); setPending(true);
          try { return await mockStartImplementation(input); } finally { setPending(false); forceRender((value: number) => value + 1); }
        },
      };
    },
    useDeleteTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  };
});
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: any) => selector({ user: { timezone: mockProfileTimezone, timeFormat: 'H24', hasCompletedOnboarding: true } }),
}));
jest.mock('../components/RecoverySection', () => ({ RecoverySection: () => null }));
jest.mock('../components/ProgressRing', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ProgressRing: ({ completed, total }: { completed: number; total: number }) =>
      React.createElement(Text, { testID: 'today-progress' }, `${completed}/${total}`),
  };
});
jest.mock('../components/timeline/Timeline', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Timeline: ({ tasks, focusedTaskId, renderFocusedTask }: any) => {
      const focusedTask = tasks.find((task: any) => task.id === focusedTaskId);
      return React.createElement(
        View,
        { testID: 'timeline' },
        focusedTask && renderFocusedTask ? renderFocusedTask(focusedTask) : null,
      );
    },
  };
});
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
    mockStartImplementation = async (input) => {
      const id = typeof input === 'string' ? input : input.id;
      const server = { ...mockTasks.find((task) => task.id === id), startedAt: new Date('2026-08-14T10:16:27.456Z') };
      mockTasks = mockTasks.map((task) => task.id === id ? server : task); return server;
    };
    mockToggleImplementation = async (input) => {
      const id = typeof input === 'string' ? input : input.id;
      const server = { ...mockTasks.find((task) => task.id === id), completedAt: new Date('2026-08-14T10:16:27.456Z') };
      mockTasks = mockTasks.map((task) => task.id === id ? server : task);
      return server;
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
    expect(screen.getByText('Сейчас')).toBeTruthy();
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
    expect(mockStart).not.toHaveBeenCalled(); expect(screen.getByText('Сейчас')).toBeTruthy();
    expect(screen.getByText('Начать')).toBeTruthy(); expect(screen.queryByText('Завершить')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('Начать')); });
    expect(screen.getByText('Начато')).toBeTruthy();
    expect(mockStart).toHaveBeenCalledTimes(1); expect(mockStart).toHaveBeenCalledWith('current');
    expect(mockTasks[0].startedAt).toEqual(new Date('2026-08-14T10:16:27.456Z'));
    expect(mockTasks[0].startTime).toBe(originalStart);
    expect(screen.getByTestId('now-card-completion').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
    fireEvent.press(screen.getByTestId('now-card-completion')); expect(mockToggle).toHaveBeenCalledWith('current');
  });

  it('shows explicit start for an upcoming task', () => {
    mockTasks = [scheduled('upcoming', '2026-08-14T11:00:00Z')]; render(<TodayScreen />);
    expect(screen.getByText('Дальше')).toBeTruthy(); expect(screen.getByText('Начать')).toBeTruthy();
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

      expect(screen.getByText('Дальше')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Изменить задачу Задача current' })).toBeDisabled();
    const server = { ...mockTasks[0], startedAt: new Date('2026-08-14T10:17:00Z') }; mockTasks = [server];
    await act(async () => resolve(server));
  });

  it('offers Stay or an explicit pending switch for a typed active-task conflict', async () => {
    const activeTitle = 'Очень длинная текущая задача, название которой переносится в диалоге';
    mockTasks = [
      { ...scheduled('old', '2026-08-14T09:00:00Z'), title: activeTitle, startedAt: new Date('2026-08-14T09:05:00Z') },
      scheduled('target', '2026-08-14T10:00:00Z'),
    ];
    let resolveSwitch!: (value: any) => void;
    mockStartImplementation = async (input) => {
      if (typeof input === 'string') {
        throw { response: { status: 409, data: { code: 'ACTIVE_TASK_CONFLICT', message: 'conflict', activeTask: { id: 'old', title: activeTitle, startedAt: mockTasks[0].startedAt } } } };
      }
      return new Promise((resolve) => { resolveSwitch = resolve; });
    };
    render(<TodayScreen />);
    await act(async () => fireEvent.press(screen.getByText('Начать')));
    expect(screen.getByTestId('focus-dialog').props.accessibilityLabel).toContain(activeTitle);
    expect(screen.getByText(`Сейчас выполняется «${activeTitle}». Переключиться?`)).toBeTruthy();
    fireEvent.press(screen.getByText('Остаться'));
    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(mockStart).toHaveBeenCalledTimes(1);

    await act(async () => fireEvent.press(screen.getByText('Начать')));
    fireEvent(screen.getByTestId('focus-dialog-modal'), 'requestClose');
    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(mockStart).toHaveBeenCalledTimes(2);

    await act(async () => fireEvent.press(screen.getByText('Начать')));
    fireEvent.press(screen.getByText('Переключиться'));
    expect(mockStart).toHaveBeenLastCalledWith({ id: 'target', activeTaskId: 'old', confirmSwitch: true });
    expect(screen.getByText('Переключаем…')).toBeDisabled();
    fireEvent(screen.getByTestId('focus-dialog-modal'), 'requestClose');
    expect(screen.getByTestId('focus-dialog')).toBeTruthy();
    expect(mockStart).toHaveBeenCalledTimes(4);
    const canonical = { ...mockTasks[1], startedAt: new Date('2026-08-14T10:15:07Z') };
    mockTasks = [{ ...mockTasks[0], startedAt: null, completedAt: null }, canonical];
    await act(async () => resolveSwitch(canonical));
    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(mockToggle).not.toHaveBeenCalled();
    expect(mockTasks).toEqual([
      expect.objectContaining({ id: 'old', startedAt: null, completedAt: null }),
      expect.objectContaining({ id: 'target', completedAt: null }),
    ]);
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0/2');
  });

  it('reconciles a failed confirmed switch without leaving optimistic active state', async () => {
    mockTasks = [
      { ...scheduled('old', '2026-08-14T09:00:00Z'), title: 'Текущая', startedAt: new Date('2026-08-14T09:05:00Z') },
      scheduled('target', '2026-08-14T10:00:00Z'),
    ];
    mockStartImplementation = async (input) => {
      if (typeof input === 'string') {
        throw { response: { status: 409, data: { code: 'ACTIVE_TASK_CONFLICT', message: 'conflict', activeTask: { id: 'old', title: 'Текущая', startedAt: mockTasks[0].startedAt } } } };
      }
      throw new Error('switch offline');
    };

    render(<TodayScreen />);
    await act(async () => fireEvent.press(screen.getByText('Начать')));
    await act(async () => fireEvent.press(screen.getByText('Переключиться')));

    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось переключить задачу. Обновите день и попробуйте снова.');
    expect(mockTasks[0].startedAt).toEqual(new Date('2026-08-14T09:05:00Z'));
    expect(mockTasks[1].startedAt).toBeNull();
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
    fireEvent.press(screen.getByTestId('week-day-2026-08-15'));
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
    render(<TodayScreen />); fireEvent(screen.getByTestId('now-card-first-step'), 'longPress');
    const start = screen.getByText('Начать с этого шага'); fireEvent.press(start); fireEvent.press(start);
    expect(mockStart).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Начать с маленького шага задачу Задача current' })).toBeDisabled();
    await act(async () => reject(new Error('offline')));
    expect(screen.getByText('Сохранённый шаг')).toBeTruthy(); expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.press(screen.getByTestId('week-day-2026-08-15'));
    expect(screen.queryByText('Начать с малого')).toBeNull(); expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.press(screen.getByTestId('week-day-2026-08-14'));
    expect(screen.getByTestId('now-card-first-step')).toBeTruthy();
    fireEvent(screen.getByTestId('now-card-first-step'), 'longPress');
    expect(screen.getByText('Сохранённый шаг')).toBeTruthy();
    mockStartImplementation = async () => { const server = { ...mockTasks[0], startedAt: new Date('2026-08-14T10:30:00Z') }; mockTasks = [server]; return server; };
    await act(async () => fireEvent.press(screen.getByText('Начать с этого шага')));
    expect(mockStart).toHaveBeenCalledTimes(2); expect(screen.getByText('Начато')).toBeTruthy();
  });

  it('cancels a future completion by action, backdrop, or Android back without mutation or progress flash', () => {
    mockTasks = [scheduled('future', '2026-08-14T11:00:00Z')];
    render(<TodayScreen />);

    const open = () => fireEvent.press(screen.getByTestId('now-card-completion'));
    open();
    expect(screen.getByText('Задача запланирована на 11:00. Отметить выполненной сейчас?')).toBeTruthy();
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0/1');
    fireEvent.press(screen.getByText('Отмена'));

    open();
    fireEvent.press(screen.getByTestId('focus-dialog-backdrop', { includeHiddenElements: true }));
    open();
    fireEvent(screen.getByTestId('focus-dialog-modal'), 'requestClose');

    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(mockToggle).not.toHaveBeenCalled();
    expect(mockTasks[0].completedAt).toBeNull();
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0/1');
  });

  it('waits for the canonical future-completion response, blocks duplicates, and updates progress only after success', async () => {
    mockTasks = [scheduled('future', '2026-08-14T11:00:00Z')];
    let resolve!: (value: any) => void;
    mockToggleImplementation = () => new Promise((done) => { resolve = done; });
    render(<TodayScreen />);

    fireEvent.press(screen.getByTestId('now-card-completion'));
    const confirm = screen.getByText('Выполнено');
    fireEvent.press(confirm);
    fireEvent.press(confirm);
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(mockToggle).toHaveBeenCalledWith({ id: 'future', optimistic: false });
    expect(mockTasks[0].completedAt).toBeNull();
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0/1');
    fireEvent(screen.getByTestId('focus-dialog-modal'), 'requestClose');
    expect(screen.getByTestId('focus-dialog')).toBeTruthy();

    const canonical = { ...mockTasks[0], completedAt: new Date('2026-08-14T10:16:00Z') };
    mockTasks = [canonical];
    await act(async () => resolve(canonical));

    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(screen.getByTestId('today-progress')).toHaveTextContent('1/1');
  });

  it('keeps a future task open and retryable when confirmed completion fails', async () => {
    mockTasks = [scheduled('future', '2026-08-14T11:00:00Z')];
    mockToggleImplementation = async () => { throw new Error('offline'); };
    render(<TodayScreen />);

    fireEvent.press(screen.getByTestId('now-card-completion'));
    await act(async () => fireEvent.press(screen.getByText('Выполнено')));

    expect(screen.getByTestId('focus-dialog')).toBeTruthy();
    expect(screen.getByText('Не удалось отметить задачу выполненной. Попробуйте снова.')).toBeTruthy();
    expect(mockTasks[0].completedAt).toBeNull();
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0/1');
    expect(screen.getByText('Выполнено')).toBeEnabled();
  });

  it('does not require future-completion confirmation for an already started occurrence', () => {
    mockTasks = [{
      ...scheduled('occurrence', '2026-08-14T11:00:00Z'),
      parentTaskId: 'series-template',
      startedAt: new Date('2026-08-14T10:10:00Z'),
    }];
    render(<TodayScreen />);

    fireEvent.press(screen.getByTestId('now-card-completion'));
    expect(mockToggle).toHaveBeenCalledWith('occurrence');
    expect(screen.queryByTestId('focus-dialog')).toBeNull();
  });

  it('cancels an early start by action, backdrop, or Android back and preserves scheduled time', () => {
    mockTasks = [scheduled('future', '2026-08-14T11:00:00Z')];
    const originalStart = mockTasks[0].startTime;
    render(<TodayScreen />);

    const open = () => fireEvent.press(screen.getByText('Начать'));
    open();
    expect(screen.getByText('Задача запланирована на 11:00. Начать сейчас?')).toBeTruthy();
    fireEvent.press(screen.getByText('Отмена'));
    open();
    fireEvent.press(screen.getByTestId('focus-dialog-backdrop', { includeHiddenElements: true }));
    open();
    fireEvent(screen.getByTestId('focus-dialog-modal'), 'requestClose');

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockTasks[0].startedAt).toBeNull();
    expect(mockTasks[0].startTime).toBe(originalStart);
  });

  it('sequences early-start and active-task confirmations before one canonical switch', async () => {
    const originalTargetStart = new Date('2026-08-14T11:00:00Z');
    mockTasks = [
      { ...scheduled('old', '2026-08-14T09:00:00Z'), startedAt: new Date('2026-08-14T09:05:00Z') },
      scheduled('target', originalTargetStart.toISOString()),
    ];
    mockStartImplementation = async (input) => {
      if (typeof input !== 'string' && input.confirmEarlyStart && !input.confirmSwitch) {
        throw {
          response: {
            status: 409,
            data: {
              code: 'ACTIVE_TASK_CONFLICT',
              message: 'conflict',
              activeTask: { id: 'old', title: mockTasks[0].title, startedAt: mockTasks[0].startedAt },
            },
          },
        };
      }
      const canonical = { ...mockTasks[1], startedAt: new Date('2026-08-14T10:16:27.456Z') };
      mockTasks = [{ ...mockTasks[0], startedAt: null, completedAt: null }, canonical];
      return canonical;
    };
    render(<TodayScreen />);

    fireEvent.press(screen.getByText('Начать'));
    await act(async () => fireEvent.press(screen.getByText('Начать сейчас')));
    expect(mockStart).toHaveBeenLastCalledWith({ id: 'target', confirmEarlyStart: true });
    expect(mockTasks[0].startedAt).toEqual(new Date('2026-08-14T09:05:00Z'));
    expect(mockTasks[1].startedAt).toBeNull();
    expect(screen.getByText(/Сейчас выполняется/)).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText('Переключиться')));

    expect(mockStart).toHaveBeenLastCalledWith({ id: 'target', activeTaskId: 'old', confirmSwitch: true, confirmEarlyStart: true });
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(mockToggle).not.toHaveBeenCalled();
    expect(mockTasks[0]).toEqual(expect.objectContaining({ startedAt: null, completedAt: null }));
    expect(mockTasks[1]).toEqual(expect.objectContaining({ startTime: originalTargetStart, completedAt: null }));
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0/2');
  });
});
