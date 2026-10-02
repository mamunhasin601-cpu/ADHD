/**
 * InboxScreen component tests — рендерит реальный компонент InboxScreen.
 *
 * Использует @testing-library/react-native для render + fireEvent.
 * Хуки useInboxTasks и useToggleInboxTask замоканы; expo-router замокан.
 * Доказывает: loading, empty, populated, error/retry, tap→router.push, long-press toggle.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet } from 'react-native';
import InboxScreen from '../app/(tabs)/inbox';
import { useInboxTasks, useToggleInboxTask } from '../lib/api/tasks';
import { ORBITS_THEMES, OrbitsThemeProvider, type OrbitsThemeName } from '../theme/orbits';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: (props: any) => require('react').createElement('StatusBar', { testID: 'inbox-status-bar', ...props }),
}));

jest.mock('../lib/api/tasks', () => ({
  useInboxTasks: jest.fn(),
  useToggleInboxTask: jest.fn(),
}));

const mockUseInboxTasks = useInboxTasks as jest.MockedFunction<typeof useInboxTasks>;
const mockUseToggleInboxTask = useToggleInboxTask as jest.MockedFunction<typeof useToggleInboxTask>;

const mockMutate = jest.fn();

const baseTask = {
  id: 'task-screen-1',
  userId: 'user-1',
  title: 'Задача без времени',
  startTime: null,
  completedAt: null,
  startedAt: null, firstStep: null,
  isRecurring: false,
  parentTaskId: null,
  durationMinutes: 30,
  color: '#6B5BFC',
  subTasks: [],
  recurrenceRule: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupToggle() {
  mockUseToggleInboxTask.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as any);
}

function themedInbox(theme: OrbitsThemeName) {
  return (
    <OrbitsThemeProvider theme={theme}>
      <InboxScreen />
    </OrbitsThemeProvider>
  );
}

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InboxScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupToggle();
  });

  // ── Loading state ─────────────────────────────────────────

  it('loading: показывает ActivityIndicator пока данные загружаются', () => {
    mockUseInboxTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    expect(
      screen.getByLabelText('Загрузка мыслей'),
    ).toBeTruthy();
  });

  // ── Empty state ───────────────────────────────────────────

  it('empty: показывает пустое состояние когда задач нет', () => {
    mockUseInboxTasks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    expect(screen.getByText('Мысли')).toBeTruthy();
    expect(screen.getByText('Запиши, чтобы не держать в голове')).toBeTruthy();
    expect(screen.getByText('Здесь пока спокойно')).toBeTruthy();
  });

  it('empty: не показывает список задач когда пусто', () => {
    mockUseInboxTasks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    expect(screen.queryByText(baseTask.title)).toBeNull();
  });

  // ── Populated state ───────────────────────────────────────

  it('populated: показывает название задачи', () => {
    mockUseInboxTasks.mockReturnValue({
      data: [baseTask],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    expect(screen.getByText(baseTask.title)).toBeTruthy();
  });

  it('populated: нажатие на задачу вызывает router.push с task-form', () => {
    mockUseInboxTasks.mockReturnValue({
      data: [baseTask],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    fireEvent.press(screen.getByText(baseTask.title));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/task-form' }),
    );
    const callArg = mockPush.mock.calls[0][0];
    expect(JSON.parse(callArg.params.task).id).toBe(baseTask.id);
  });

  it('populated: долгое нажатие вызывает useToggleInboxTask.mutate с id задачи', () => {
    mockUseInboxTasks.mockReturnValue({
      data: [baseTask],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    fireEvent(screen.getByText(baseTask.title), 'longPress');

    expect(mockMutate).toHaveBeenCalledWith(baseTask.id);
  });

  it('populated: долгое нажатие НЕ использует dated toggle hook', () => {
    // Убеждаемся что useToggleInboxTask вызывается (без аргумента Date(0))
    mockUseInboxTasks.mockReturnValue({
      data: [baseTask],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    // useToggleInboxTask не принимает параметр Date — подпись: useToggleInboxTask()
    expect(mockUseToggleInboxTask).toHaveBeenCalledWith(); // без аргументов
  });

  // ── Completed task visual state ───────────────────────────

  it('completed: задача с completedAt отображается с accessible label "выполнена"', () => {
    const completedTask = { ...baseTask, id: 'completed-task', completedAt: new Date() };
    mockUseInboxTasks.mockReturnValue({
      data: [completedTask],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    // accessibilityLabel содержит "выполнена"
    const element = screen.getByLabelText(
      `Запись выполнена: ${completedTask.title}. Долгое нажатие отменит отметку.`,
    );
    expect(element).toBeTruthy();
  });

  // ── Error state + retry ───────────────────────────────────

  it('error: показывает текст ошибки и кнопку retry', () => {
    mockUseInboxTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    expect(screen.getByText(/Не удалось загрузить/)).toBeTruthy();
    expect(screen.getByLabelText('Повторить загрузку')).toBeTruthy();
  });

  it('retry: нажатие на кнопку retry вызывает refetch', () => {
    const mockRefetch = jest.fn();
    mockUseInboxTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    } as any);

    render(<InboxScreen />);

    fireEvent.press(screen.getByLabelText('Повторить загрузку'));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('error: не отображает список задач при ошибке', () => {
    mockUseInboxTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    } as any);

    render(<InboxScreen />);

    expect(screen.queryByText('Здесь пока спокойно')).toBeNull();
  });

  describe('Orbits theme application', () => {
    it.each(['warm', 'dark'] as const)(
      'uses %s tokens for canvas, content, completed state and data color',
      (name) => {
        const theme = ORBITS_THEMES[name];
        const dataColor = ORBITS_THEMES.warm.rewardPrimary;
        const openTask = {
          ...baseTask,
          color: dataColor,
          subTasks: [{ id: 'subtask-1', title: 'Подзадача' }],
        };
        const completedTask = {
          ...baseTask,
          id: 'completed-task',
          title: 'Завершённая мысль',
          completedAt: new Date(),
        };
        mockUseInboxTasks.mockReturnValue({
          data: [openTask, completedTask],
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        } as any);

        render(themedInbox(name));

        expect(styleOf('inbox-screen').backgroundColor).toBe(theme.background);
        expect(styleOf('inbox-header')).toMatchObject({
          backgroundColor: theme.surfacePrimary,
          borderBottomColor: theme.borderSubtle,
        });
        expect(styleOf('inbox-header-title').color).toBe(theme.brand);
        expect(styleOf('inbox-header-subtitle').color).toBe(theme.textSecondary);
        expect(screen.getByTestId('inbox-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');

        expect(styleOf(`inbox-task-${openTask.id}`).backgroundColor).toBe(theme.surfacePrimary);
        expect(styleOf(`inbox-task-title-${openTask.id}`).color).toBe(theme.textPrimary);
        expect(styleOf(`inbox-task-subtasks-${openTask.id}`).color).toBe(theme.textSecondary);
        expect(styleOf(`inbox-task-dot-${openTask.id}`).backgroundColor).toBe(dataColor);
        expect(styleOf(`inbox-task-chevron-${openTask.id}`).color).toBe(theme.textSecondary);
        expect(styleOf('inbox-divider').backgroundColor).toBe(theme.borderSubtle);

        expect(styleOf(`inbox-task-${completedTask.id}`).backgroundColor).toBe(theme.completionSoft);
        expect(styleOf(`inbox-task-dot-${completedTask.id}`).backgroundColor).toBe(theme.completionPrimary);
        expect(styleOf(`inbox-task-title-${completedTask.id}`)).toMatchObject({
          color: theme.completionPrimary,
          textDecorationLine: 'line-through',
        });
      },
    );

    it.each(['warm', 'dark'] as const)('themes %s loading, empty, error and retry states', (name) => {
      const theme = ORBITS_THEMES[name];
      mockUseInboxTasks.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: jest.fn(),
      } as any);
      const view = render(themedInbox(name));
      expect(screen.getByTestId('inbox-loading').props.color).toBe(theme.brand);

      mockUseInboxTasks.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);
      view.rerender(themedInbox(name));
      expect(styleOf('inbox-empty-title').color).toBe(theme.textPrimary);
      expect(styleOf('inbox-empty-text').color).toBe(theme.textSecondary);

      mockUseInboxTasks.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: jest.fn(),
      } as any);
      view.rerender(themedInbox(name));
      expect(styleOf('inbox-error').color).toBe(theme.errorPrimary);
      expect(styleOf('inbox-retry').backgroundColor).toBe(theme.brand);
      expect(StyleSheet.flatten(screen.getByText('Повторить').props.style).color).toBe(theme.retryText);
      const retry = screen.UNSAFE_getByType(Pressable);
      expect(StyleSheet.flatten(retry.props.style({ pressed: true })).backgroundColor).toBe(theme.brandPressed);
    });

    it('switches warm to dark through rerender without losing data or behavior', () => {
      const dataColor = ORBITS_THEMES.warm.rewardPrimary;
      const task = { ...baseTask, color: dataColor };
      mockUseInboxTasks.mockReturnValue({
        data: [task],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);
      const view = render(themedInbox('warm'));

      expect(styleOf('inbox-screen').backgroundColor).toBe(ORBITS_THEMES.warm.background);
      view.rerender(themedInbox('dark'));
      expect(styleOf('inbox-screen').backgroundColor).toBe(ORBITS_THEMES.dark.background);
      expect(styleOf(`inbox-task-${task.id}`).backgroundColor).toBe(ORBITS_THEMES.dark.surfacePrimary);
      expect(styleOf(`inbox-task-dot-${task.id}`).backgroundColor).toBe(dataColor);
      expect(screen.getByText(task.title)).toBeTruthy();

      fireEvent.press(screen.getByTestId(`inbox-task-${task.id}`));
      fireEvent(screen.getByTestId(`inbox-task-${task.id}`), 'longPress');
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/task-form' }));
      expect(mockMutate).toHaveBeenCalledWith(task.id);
    });
  });
});
