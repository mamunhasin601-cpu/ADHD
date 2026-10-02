const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockToggle = jest.fn();
const mockRecoverySection = jest.fn(() => null);
let mockQueryState: {
  data: any[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  error?: unknown;
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: jest.fn(), useLocalSearchParams: () => ({}) }));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: jest.fn() }),
}));

jest.mock('../lib/notification-lifecycle', () => ({
  useNotificationLifecycle: () => ({
    permission: 'not-asked',
    invitation: 'deferred',
    busy: false,
    error: null,
    requestPermission: jest.fn(),
    deferInvitation: jest.fn(),
    openSettings: jest.fn(),
  }),
}));
jest.mock('../lib/api/tasks', () => ({
  getActiveTaskConflict: () => null,
  useTasksForDate: () => ({ ...mockQueryState, refetch: mockRefetch }),
  useCreateTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useToggleTask: () => ({ mutate: mockToggle, isPending: false }),
  useStartTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: any) => selector({
    user: {
      timezone: 'UTC',
      timeFormat: 'H24',
      hasCompletedOnboarding: false,
    },
  }),
}));
jest.mock('../components/RecoverySection', () => ({ RecoverySection: () => mockRecoverySection() }));
jest.mock('../components/NowCard', () => {
  const { View } = require('react-native');
  return { NowCard: () => <View testID="now-card" /> };
});
jest.mock('../components/timeline/Timeline', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Timeline: ({ tasks, focusedTaskId, renderFocusedTask }: any) => (
      <View testID="timeline">
        {tasks.map((task: any) => task.id === focusedTaskId && renderFocusedTask
          ? <React.Fragment key={task.id}>{renderFocusedTask(task)}</React.Fragment>
          : <Text key={task.id}>{task.title}</Text>)}
      </View>
    ),
  };
});
jest.mock('expo-status-bar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { StatusBar: (props: any) => React.createElement(View, { ...props, testID: 'today-status-bar' }) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayScreen from '../app/(tabs)/today';
import { ORBITS_THEMES, OrbitsThemeProvider, type OrbitsThemeName } from '../theme/orbits';

function renderToday(theme: OrbitsThemeName) {
  return render(<OrbitsThemeProvider theme={theme}><TodayScreen /></OrbitsThemeProvider>);
}

const unscheduledTask = (completed: boolean) => ({
  id: completed ? 'done' : 'open',
  userId: 'user',
  title: completed ? 'Готовая мысль' : 'Открытая мысль',
  startTime: null,
  durationMinutes: null,
  color: '#6B5BFC',
  isRecurring: false,
  recurrenceRule: null,
  parentTaskId: null,
  completedAt: completed ? new Date('2026-08-15T09:00:00Z') : null,
  startedAt: null,
  firstStep: null,
  subTasks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-15T10:00:00Z'));
});

afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryState = {
    data: [],
    isLoading: false,
    isError: false,
    isRefetching: false,
  };
});

describe('Today query states', () => {
  it('shows calm loading without fabricated progress', () => {
    mockQueryState.isLoading = true;
    render(<TodayScreen />);

    expect(screen.getByText('Загружаем ваш день…')).toBeTruthy();
    expect(screen.queryByText('0 задач')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows sanitized error without fabricated progress or raw logging', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockQueryState.isError = true;
    mockQueryState.error = new Error('Axios GET https://private.example/token');
    render(<TodayScreen />);

    expect(screen.getByText('Не удалось загрузить ваш день.')).toBeTruthy();
    expect(screen.queryByText(/Axios|private\.example|token/)).toBeNull();
    expect(screen.queryByText('0 задач')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('retries exactly once', () => {
    mockQueryState.isError = true;
    render(<TodayScreen />);

    fireEvent.press(screen.getByLabelText('Повторить загрузку'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('marks retry disabled and busy while refetching', () => {
    mockQueryState.isError = true;
    mockQueryState.isRefetching = true;
    render(<TodayScreen />);

    const retry = screen.getByLabelText('Повторить загрузку');
    expect(retry.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(retry);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('shows truthful zero progress after a loaded empty response', () => {
    render(<TodayScreen />);

    expect(screen.getByText('0 задач')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('○')).toBeNull();
  });
});

describe('Today physical-device reachability regression', () => {
  it('does not mount Recovery or reserve an extra block before the timeline', () => {
    mockQueryState.data = [
      { ...unscheduledTask(false), id: 'next', startTime: '2026-08-15T11:00:00.000Z' },
    ];
    render(<TodayScreen />);
    expect(mockRecoverySection).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recovery-section')).toBeNull();
    const content = screen.getByTestId('today-content-scroll');
    expect(React.Children.toArray(content.props.children)).toHaveLength(1);
    expect(screen.getByTestId('timeline')).toBeTruthy();
  });

  it('embeds the focused task and the next task inside the timeline body', () => {
    mockQueryState.data = [
      { ...unscheduledTask(false), id: 'current', title: 'Текущая', startTime: '2026-08-15T09:00:00.000Z' },
      { ...unscheduledTask(false), id: 'next', title: 'Следующая', startTime: '2026-08-15T11:00:00.000Z' },
    ];
    render(<TodayScreen />);
    expect(screen.getByTestId('today-content-scroll')).toBeTruthy();
    expect(screen.getByTestId('now-card')).toBeTruthy();
    expect(screen.queryByTestId('today-next-task-preview')).toBeNull();
    expect(screen.getByText('Следующая')).toBeTruthy();
    expect(screen.getByTestId('timeline')).toBeTruthy();
  });
});

describe('unscheduled cards', () => {
  it('exposes checked and unchecked states with a visible completion cue', () => {
    mockQueryState.data = [unscheduledTask(false), unscheduledTask(true)];
    render(<TodayScreen />);

    const open = screen.getByLabelText('Открытая мысль');
    const done = screen.getByLabelText('Готовая мысль, Выполнено');
    expect(open.props.accessibilityState.checked).toBe(false);
    expect(done.props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('✓ Готово')).toBeTruthy();

    fireEvent.press(open);
    expect(mockToggle).toHaveBeenCalledWith('open');
  });
});


describe('Today Orbits theme application', () => {
  it.each(['warm', 'dark'] as const)('uses the %s canvas and deterministic StatusBar', (name) => {
    renderToday(name);
    const screenStyle = Object.assign({}, ...screen.getByTestId('today-screen').props.style.filter(Boolean));
    expect(screenStyle.backgroundColor).toBe(ORBITS_THEMES[name].background);
    expect(screen.getByTestId('today-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');
  });
});
