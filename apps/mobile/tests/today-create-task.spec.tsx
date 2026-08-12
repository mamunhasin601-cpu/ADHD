const mockPush = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetchQueries = jest.fn();
let mockCreatePending = false;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: mockRefetchQueries }),
}));
jest.mock('../lib/api/tasks', () => ({
  useTasksForDate: jest.fn(() => ({ data: [], isLoading: false, isError: false })),
  useCreateTask: jest.fn(() => ({ mutateAsync: mockMutateAsync, isPending: mockCreatePending })),
  useToggleTask: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ user: { timezone: 'Europe/Moscow', timeFormat: 'H24' } })),
}));
jest.mock('../components/RecoverySection', () => ({ RecoverySection: () => null }));
jest.mock('../components/ProgressRing', () => ({ ProgressRing: () => null }));
jest.mock('../components/NowCard', () => ({ NowCard: () => null }));
jest.mock('../components/timeline/Timeline', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    Timeline: ({ tasks, onCreateAt }: any) => (
      <View>
        {tasks.map((task: any) => <Text key={task.id}>{task.title}</Text>)}
        <Pressable onPress={() => onCreateAt(new Date(2026, 7, 12, 14, 30))}>
          <Text>Выбрать 14:30</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock('../components/EmptyState', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    EmptyState: ({ title, actionLabel, onAction }: any) => (
      <View>
        <Text>{title}</Text>
        <Pressable onPress={onAction}><Text>{actionLabel}</Text></Pressable>
      </View>
    ),
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TodayScreen from '../app/(tabs)/today';
import { useTasksForDate } from '../lib/api/tasks';

const scheduledTask = {
  id: 'scheduled-task',
  title: 'Существующая задача',
  startTime: '2026-08-12T08:00:00.000Z',
  completedAt: null,
  durationMinutes: 30,
};

function openGlobalCapture() {
  fireEvent.press(screen.getByLabelText('Быстро добавить задачу'));
}

function renderWithTimeline() {
  (useTasksForDate as jest.Mock).mockReturnValue({
    data: [scheduledTask],
    isLoading: false,
    isError: false,
  });
  render(<TodayScreen />);
  fireEvent.press(screen.getByText('Выбрать 14:30'));
}

describe('Today quick capture destinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePending = false;
    mockMutateAsync.mockResolvedValue({ id: 'created-task' });
    mockRefetchQueries.mockResolvedValue(undefined);
    (useTasksForDate as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('keeps the empty-state full task form CTA behavior', () => {
    render(<TodayScreen />);
    fireEvent.press(screen.getByText('Создать задачу'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: { selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
  });

  it('labels global capture with Thoughts language and creates without a start time', async () => {
    render(<TodayScreen />);
    openGlobalCapture();

    expect(screen.getByText('Сохранить в Мысли')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Купить молоко  ');
    fireEvent.press(screen.getByText('Сохранить в Мысли'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Купить молоко',
      startTime: null,
      durationMinutes: null,
    }));
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('creates timeline capture at the selected ISO time', async () => {
    renderWithTimeline();

    expect(screen.getByText('Выбранное время: 14:30')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Встреча  ');
    fireEvent.press(screen.getByText('Добавить на 14:30'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Встреча',
      startTime: new Date(2026, 7, 12, 14, 30).toISOString(),
      durationMinutes: null,
    }));
  });

  it('can save timeline capture to Thoughts without a start time', async () => {
    renderWithTimeline();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Идея  ');
    fireEvent.press(screen.getByText('В Мысли'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Идея',
      startTime: null,
      durationMinutes: null,
    }));
  });

  it('preserves a numeric duration for timed and Thoughts destinations', async () => {
    renderWithTimeline();
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Timed');
    fireEvent.press(screen.getByText('Добавить на 14:30'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      startTime: expect.any(String), durationMinutes: 45,
    })));

    renderWithTimeline();
    fireEvent.press(screen.getByLabelText('Длительность 90 мин'));
    fireEvent.changeText(screen.getAllByLabelText('Название задачи').at(-1)!, 'Thought');
    fireEvent.press(screen.getAllByText('В Мысли').at(-1)!);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      startTime: null, durationMinutes: 90,
    })));
  });

  it('passes numeric duration to the full form', () => {
    render(<TodayScreen />);
    openGlobalCapture();
    fireEvent.press(screen.getByLabelText('Длительность 120 мин'));
    fireEvent.press(screen.getByText('Подробнее →'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ prefillDurationMinutes: '120' }),
    }));
  });

  it('keeps selected duration after a failed creation', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('network'));
    render(<TodayScreen />);
    openGlobalCapture();
    fireEvent.press(screen.getByLabelText('Длительность 60 мин'));
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Retry me');
    fireEvent.press(screen.getByText('Сохранить в Мысли'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Retry me')).toBeTruthy();
    expect(screen.getByLabelText('Длительность 60 мин').props.accessibilityState).toEqual({ selected: true });
  });

  it('preserves the trimmed title in the full-form prefill', () => {
    render(<TodayScreen />);
    openGlobalCapture();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Разобрать почту  ');
    fireEvent.press(screen.getByText('Подробнее →'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: {
        prefillTitle: 'Разобрать почту',
        selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
  });

  it('preserves the trimmed title and selected time in full-form prefills', () => {
    renderWithTimeline();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Позвонить  ');
    fireEvent.press(screen.getByText('Подробнее →'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: {
        prefillTitle: 'Позвонить',
        prefillStartTime: new Date(2026, 7, 12, 14, 30).toISOString(),
        selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
  });

  it('does not submit a blank title', () => {
    render(<TodayScreen />);
    openGlobalCapture();
    const submit = screen.getByLabelText('Сохранить задачу в Мысли');

    expect(submit.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(submit);
    fireEvent(screen.getByLabelText('Название задачи'), 'submitEditing');
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
  });

  it('disables every creation destination and planning while creation is pending', () => {
    mockCreatePending = true;
    renderWithTimeline();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Задача');

    const timed = screen.getByLabelText('Добавить задачу на 14:30');
    const thoughts = screen.getByLabelText('Сохранить задачу в Мысли без времени');
    const fullForm = screen.getByLabelText('Открыть полную форму задачи');
    expect(timed.props.accessibilityState).toEqual({ disabled: true });
    expect(thoughts.props.accessibilityState).toEqual({ disabled: true });
    expect(fullForm.props.accessibilityState).toEqual({ disabled: true });

    fireEvent.press(timed);
    fireEvent.press(thoughts);
    fireEvent.press(fullForm);
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
  });
});
