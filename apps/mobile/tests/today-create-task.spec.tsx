const mockPush = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetchQueries = jest.fn();
let mockCreatePending = false;
let mockTimeFormat: "H24" | "H12" = "H24";

jest.mock("../lib/notification-lifecycle", () => ({ useNotificationLifecycle: () => ({ permission: "not-asked", invitation: "deferred", busy: false, error: null, requestPermission: jest.fn(), deferInvitation: jest.fn(), openSettings: jest.fn() }) }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/today",
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ refetchQueries: mockRefetchQueries }),
}));
jest.mock("../lib/api/tasks", () => ({
  useTasksForDate: jest.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
  })),
  useCreateTask: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: mockCreatePending,
  })),
  useToggleTask: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useStartTask: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateTask: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));
jest.mock("../stores/auth.store", () => {
  const state = () => ({
    user: { id: "user-a", timezone: "Europe/Moscow", timeFormat: mockTimeFormat },
    sessionGeneration: 1,
  });
  const useAuthStore: any = jest.fn((selector: any) => selector(state()));
  useAuthStore.getState = state;
  return { useAuthStore };
});
jest.mock("../components/RecoverySection", () => ({
  RecoverySection: () => null,
}));
jest.mock("../components/ProgressRing", () => ({ ProgressRing: () => null }));
jest.mock("../components/NowCard", () => ({ NowCard: () => null }));
jest.mock("../components/timeline/Timeline", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    Timeline: ({ tasks, onCreateAt }: any) => (
      <View>
        {tasks.map((task: any) => (
          <Text key={task.id}>{task.title}</Text>
        ))}
        <Pressable onPress={() => onCreateAt(new Date(2026, 7, 12, 14, 30))}>
          <Text>Выбрать 14:30</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("../components/EmptyState", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    EmptyState: ({ title, actionLabel, onAction }: any) => (
      <View>
        <Text>{title}</Text>
        <Pressable onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
  };
});

import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import TodayScreen from "../app/(tabs)/today";
import { GlobalCaptureProvider } from "../components/GlobalCapture";
import { useTasksForDate } from "../lib/api/tasks";

const scheduledTask = {
  id: "scheduled-task",
  title: "Существующая задача",
  startTime: "2026-08-12T08:00:00.000Z",
  completedAt: null,
  startedAt: null, firstStep: null,
  durationMinutes: 30,
};

function openGlobalCapture() {
  fireEvent.press(screen.getByLabelText("Добавить задачу"));
}

function renderWithTimeline() {
  (useTasksForDate as jest.Mock).mockReturnValue({
    data: [scheduledTask],
    isLoading: false,
    isError: false,
  });
  render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
  fireEvent.press(screen.getByText('Выбрать 14:30'));
}

describe('Today quick capture destinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePending = false;
    mockTimeFormat = 'H24';
    mockMutateAsync.mockResolvedValue({ id: 'created-task' });
    mockRefetchQueries.mockResolvedValue(undefined);
    (useTasksForDate as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('keeps the empty-state full task form CTA behavior', () => {
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    fireEvent.press(screen.getByText('Создать задачу'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: {
        selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        selectedDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    });
  });

  it('does not describe an unplanned future day as wholly free', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    fireEvent.press(screen.getByLabelText(/четверг, 13 августа 2026/));
    expect(screen.getByText('На этот день нет задач')).toBeTruthy();
    expect(screen.queryByText('Свободный день')).toBeNull();
    jest.useRealTimers();
  });

  it('describes thoughts without scheduled tasks as unscheduled, not free time', () => {
    (useTasksForDate as jest.Mock).mockReturnValue({
      data: [{ ...scheduledTask, startTime: null }],
      isLoading: false,
      isError: false,
    });
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    expect(screen.getByText('Нет задач со временем')).toBeTruthy();
    expect(screen.queryByText('Таймлайн свободен')).toBeNull();
  });

  it.each([
    { state: { data: [], isLoading: true, isError: false }, label: /четверг, 13 августа 2026/ },
    { state: { data: [], isLoading: false, isError: true }, label: /четверг, 13 августа 2026/ },
    { state: { data: [], isLoading: false, isError: false }, label: /четверг, 13 августа 2026/ },
  ])('keeps canonical date navigation available in loading, error, and empty states', ({ state, label }) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    (useTasksForDate as jest.Mock).mockReturnValue(state);
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    fireEvent.press(screen.getByLabelText(label));
    const queriedDate = (useTasksForDate as jest.Mock).mock.calls.at(-1)[0] as Date;
    expect(queriedDate.toISOString()).toBe('2026-08-12T21:00:00.000Z');
    expect(screen.getByText('Сегодня')).toBeTruthy();
    fireEvent.press(screen.getByText('Сегодня'));
    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-11T21:00:00.000Z');
    jest.useRealTimers();
  });

  it('passes a selected profile-local day to task-form navigation without drift', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    fireEvent.press(screen.getByLabelText(/четверг, 13 августа 2026/));
    fireEvent.press(screen.getByText('Создать задачу'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: { selectedDate: '2026-08-12T21:00:00.000Z', selectedDateKey: '2026-08-13' },
    });
    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-12T21:00:00.000Z');
    jest.useRealTimers();
  });

  it('labels global capture with Thoughts language and creates without a start time', async () => {
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();

    expect(screen.getByText('Сохранить в Мысли')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Купить молоко  ');
    fireEvent.press(screen.getByText('Сохранить в Мысли'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Купить молоко',
      startTime: null,
      durationMinutes: null,
    }));
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'inbox'] });
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

  it('uses H12 consistently while preserving the exact selected instant', async () => { mockTimeFormat='H12'; renderWithTimeline(); const selected=new Date(2026,7,12,14,30); expect(screen.getByText('Выбранное время: 2:30 PM')).toBeTruthy(); fireEvent.changeText(screen.getByLabelText('Название задачи'),'Встреча'); const action=screen.getByLabelText('Добавить задачу на 2:30 PM'); expect(screen.getByText('Добавить на 2:30 PM')).toBeTruthy(); fireEvent.press(action); await waitFor(()=>expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({startTime:selected.toISOString()}))); });

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
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    fireEvent.press(screen.getByLabelText('Длительность 120 мин'));
    fireEvent.press(screen.getByText('Подробнее →'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ prefillDurationMinutes: '120' }),
    }));
  });

  it('keeps selected duration after a failed creation', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('network'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    fireEvent.press(screen.getByLabelText('Длительность 60 мин'));
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Retry me');
    fireEvent.press(screen.getByText('Сохранить в Мысли'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Retry me')).toBeTruthy();
    expect(screen.getByLabelText('Длительность 60 мин').props.accessibilityState).toEqual({ selected: true });
  });

  it('preserves the trimmed title in the full-form prefill', () => {
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Разобрать почту  ');
    fireEvent.press(screen.getByText('Подробнее →'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: {
        prefillTitle: 'Разобрать почту',
        selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        selectedDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
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
        selectedDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    });
  });

  it('does not submit a blank title', () => {
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    const submit = screen.getByLabelText('Сохранить задачу в Мысли');

    expect(submit.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: false }));
    fireEvent.press(submit);
    fireEvent(screen.getByLabelText('Название задачи'), 'submitEditing');
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
  });

  it('disables every creation destination and planning while creation is pending', () => {
    mockMutateAsync.mockReturnValueOnce(new Promise(() => undefined));
    renderWithTimeline();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Задача');
    fireEvent.press(screen.getByLabelText('Добавить задачу на 14:30'));

    const timed = screen.getByLabelText('Добавить задачу на 14:30');
    const thoughts = screen.getByLabelText('Сохранить задачу в Мысли без времени');
    const fullForm = screen.getByLabelText('Открыть полную форму задачи');
    expect(timed.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
    expect(thoughts.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
    expect(fullForm.props.accessibilityState).toEqual({ disabled: true });

    fireEvent.press(timed);
    fireEvent.press(thoughts);
    fireEvent.press(fullForm);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Отменить быстрое добавление"));
  });
});
