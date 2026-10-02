const mockPush = jest.fn();
const mockBack = jest.fn();
let mockFormParams: Record<string, string> = {};
const mockMutateAsync = jest.fn();
const mockRefetchQueries = jest.fn();
let mockCreatePending = false;
let mockTimeFormat: "H24" | "H12" = "H24";
let mockTimezone = "Europe/Moscow";

jest.mock("../lib/notification-lifecycle", () => ({ useNotificationLifecycle: () => ({ permission: "not-asked", invitation: "deferred", busy: false, error: null, requestPermission: jest.fn(), deferInvitation: jest.fn(), openSettings: jest.fn() }) }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockFormParams,
  usePathname: () => "/today",
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ refetchQueries: mockRefetchQueries }),
}));
jest.mock("../lib/api/tasks", () => ({
  getActiveTaskConflict: () => null,
  useTasksForDate: jest.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  })),
  useCreateTask: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: mockCreatePending,
  })),
  useToggleTask: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useStartTask: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateTask: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteTask: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));
jest.mock("../stores/auth.store", () => {
  const state = () => ({
    user: { id: "user-a", timezone: mockTimezone, timeFormat: mockTimeFormat },
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
import { Pressable, Text } from "react-native";
import {
  fireEvent,
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import TodayScreen from "../app/(tabs)/today";
import TaskFormScreen from "../app/task-form";
import { GlobalCaptureProvider, useGlobalCapture } from "../components/GlobalCapture";
import { useTasksForDate } from "../lib/api/tasks";
import { TIMELINE_CONFIG } from "../lib/timeline-config";

const scheduledTask = {
  id: "scheduled-task",
  title: "Существующая задача",
  startTime: "2026-08-12T08:00:00.000Z",
  completedAt: null,
  startedAt: null, firstStep: null,
  durationMinutes: 30,
};

function openGlobalCapture() {
  fireEvent.press(screen.getByLabelText("Добавить запись: задачу, мысль или отдых"));
}

// Keep the existing explicit-time Quick Capture contract covered independently
// of Today: background taps no longer supply a time or open this mode.
function ExplicitTimeCaptureOpener() {
  const { openTimelineCapture } = useGlobalCapture();
  return <Pressable onPress={() => openTimelineCapture({
    instant: new Date('2026-08-12T11:30:00.000Z'),
    selectedDate: new Date('2026-08-12T12:00:00.000Z'),
    selectedDateKey: '2026-08-12',
  })}><Text>Открыть Quick Capture с явным временем</Text></Pressable>;
}

function renderExplicitTimeCapture() {
  render(<GlobalCaptureProvider><TodayScreen /><ExplicitTimeCaptureOpener /></GlobalCaptureProvider>);
  fireEvent.press(screen.getByText('Открыть Quick Capture с явным временем'));
}

function renderWithTimeline() {
  (useTasksForDate as jest.Mock).mockReturnValue({
    data: [scheduledTask],
    isLoading: false,
    isError: false,
  });
  render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
}

function tapTimeline(hour: number) {
  const background = screen.getByTestId('timeline-create-background');
  const event = { nativeEvent: {
    pageX: 100,
    pageY: 200 + (hour - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight,
    locationY: 28,
  } };
  fireEvent(background, 'responderGrant', event);
  fireEvent(background, 'responderRelease', event);
}

function TaskFormRouteHarness() {
  const [formOpen, setFormOpen] = React.useState(false);
  mockPush.mockImplementation((route: { params: Record<string, string> }) => {
    mockFormParams = route.params;
    setFormOpen(true);
  });
  mockBack.mockImplementation(() => setFormOpen(false));
  return <GlobalCaptureProvider><TodayScreen />{formOpen && <TaskFormScreen />}</GlobalCaptureProvider>;
}

describe('Today quick capture destinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    mockPush.mockReset();
    mockBack.mockReset();
    mockFormParams = {};
    mockCreatePending = false;
    mockTimeFormat = 'H24';
    mockTimezone = 'Europe/Moscow';
    mockMutateAsync.mockResolvedValue({ id: 'created-task' });
    mockRefetchQueries.mockResolvedValue(undefined);
    (useTasksForDate as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  afterEach(async () => {
    await act(async () => cleanup());
    jest.useRealTimers();
  });

  it.each([12, 15, 18])('opens one full task form without time near %s:00', (hour) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    mockTimezone = 'Europe/Samara';
    renderWithTimeline();
    tapTimeline(hour);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task-form', params: {
      selectedDate: '2026-08-12T12:00:00.000Z', selectedDateKey: '2026-08-12', prefillKind: 'TASK',
    } });
    expect(screen.queryByLabelText('Название записи')).toBeNull();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId('timeline-create-background'), 'responderRelease', {
      nativeEvent: { pageX: 100, pageY: 500, locationY: 28 },
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['2026-08-11', '2026-08-10T20:00:00.000Z'],
    ['2026-08-12', '2026-08-11T20:00:00.000Z'],
    ['2026-08-14', '2026-08-13T20:00:00.000Z'],
  ])('passes selected historical/today/future day %s with no time prefill', (dateKey, expectedDate) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    mockTimezone = 'Europe/Samara';
    renderWithTimeline();
    fireEvent.press(screen.getByTestId(`week-day-${dateKey}`));
    const selected = (useTasksForDate as jest.Mock).mock.calls.at(-1)[0] as Date;
    tapTimeline(18);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task-form', params: {
      selectedDate: selected.toISOString(), selectedDateKey: dateKey, prefillKind: 'TASK',
    } });
    expect(selected.toISOString()).toBe(expectedDate);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('edits an existing card rather than creating a task', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    renderWithTimeline();
    fireEvent.press(screen.getByRole('button', { name: /^Существующая задача/ }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task-form', params: {
      task: JSON.stringify(scheduledTask), selectedDate: '2026-08-12T12:00:00.000Z', selectedDateKey: '2026-08-12',
    } });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does not navigate or create after a background drag', () => {
    renderWithTimeline();
    const background = screen.getByTestId('timeline-create-background');
    fireEvent(background, 'responderGrant', { nativeEvent: { pageX: 100, pageY: 300 } });
    fireEvent(background, 'responderMove', { nativeEvent: { pageX: 100, pageY: 360 } });
    fireEvent(screen.getByTestId('timeline-scroll'), 'scrollBeginDrag');
    fireEvent(background, 'responderRelease', { nativeEvent: { pageX: 100, pageY: 360 } });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('keeps Add as Quick Capture even on a selected historical day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    renderWithTimeline();
    fireEvent.press(screen.getByTestId('week-day-2026-08-11'));
    openGlobalCapture();
    expect(screen.getByLabelText('Название записи')).toBeTruthy();
    expect(screen.getByText('Сохранить в Мысли')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-10T21:00:00.000Z');
  });

  it('returns from a cancelled form to the same selected day without creating', () => {
    (useTasksForDate as jest.Mock).mockReturnValue({ data: [scheduledTask], isLoading: false, isError: false });
    render(<TaskFormRouteHarness />);
    fireEvent.press(screen.getByTestId('week-day-2026-08-11'));
    tapTimeline(15);
    expect(screen.getByRole('radio', { name: 'Задача' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('radio', { name: 'Без времени' }).props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Не сохранять');
    // A route pop, not a simulation of native Android Back dispatch.
    act(() => mockBack());
    expect(screen.queryByPlaceholderText('Название задачи')).toBeNull();
    expect(screen.getByTestId('week-day-2026-08-11').props.accessibilityState.selected).toBe(true);
    expect(mockMutateAsync).not.toHaveBeenCalled();
    tapTimeline(18);
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush.mock.calls[1][0]).toEqual(mockPush.mock.calls[0][0]);
  });

  it.each([false, true])('lets the routed form save with user-selected time enabled=%s', async (withTime) => {
    (useTasksForDate as jest.Mock).mockReturnValue({ data: [scheduledTask], isLoading: false, isError: false });
    render(<TaskFormRouteHarness />);
    fireEvent.press(screen.getByTestId('week-day-2026-08-14'));
    tapTimeline(12);
    expect(mockFormParams).toEqual({ selectedDate: '2026-08-13T21:00:00.000Z', selectedDateKey: '2026-08-14', prefillKind: 'TASK' });
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Новая задача');
    if (withTime) fireEvent.press(screen.getByRole('radio', { name: 'Указать время' }));
    fireEvent.press(screen.getByLabelText('Сохранить задачу'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Новая задача', kind: 'TASK', startTime: withTime ? expect.any(String) : null,
    })));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('week-day-2026-08-14').props.accessibilityState.selected).toBe(true);
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
    expect(screen.getByText('На этот день пока нет задач')).toBeTruthy();
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

  it('keeps a block-only day non-empty and passes the block to Timeline', () => {
    (useTasksForDate as jest.Mock).mockReturnValue({
      data: [{ ...scheduledTask, id: 'rest', title: 'Тихая пауза', kind: 'REST' }],
      isLoading: false,
      isError: false,
    });
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    expect(screen.getByText('Тихая пауза')).toBeTruthy();
    expect(screen.queryByText('Начни свой день')).toBeNull();
    expect(screen.queryByText('Нет задач со временем')).toBeNull();
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
    fireEvent.press(screen.getByTestId('week-day-2026-08-12'));
    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-11T21:00:00.000Z');
    jest.useRealTimers();
  });

  it('wires the calendar next-week accessibility action to Today navigation', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);

    fireEvent(
      screen.getByTestId('week-day-2026-08-12'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );

    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-18T21:00:00.000Z');
    jest.useRealTimers();
  });

  it('allows calendar navigation into the previous week for history', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);

    fireEvent(
      screen.getByTestId('week-day-2026-08-12'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } },
    );

    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-04T21:00:00.000Z');
    jest.useRealTimers();
  });

  it('opens the themed Focus calendar and applies the confirmed profile-local date', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);

    fireEvent.press(screen.getByLabelText('Выбрать дату'));
    expect(screen.getByTestId('today-date-picker')).toBeTruthy();

    fireEvent.press(screen.getByTestId('focus-calendar-day-2026-08-14'));

    expect((useTasksForDate as jest.Mock).mock.calls.at(-1)[0].toISOString()).toBe('2026-08-13T21:00:00.000Z');
    expect(screen.queryByTestId('today-date-picker')).toBeNull();
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
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Купить молоко  ');
    fireEvent.press(screen.getByText('Сохранить в Мысли'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Купить молоко',
      startTime: null,
      durationMinutes: null,
    }));
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'inbox'] });
  });

  it('keeps explicit-time Quick Capture creation at the supplied ISO time', async () => {
    renderExplicitTimeCapture();

    expect(screen.getByText('Выбранное время: 14:30')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Встреча  ');
    fireEvent.press(screen.getByText('Добавить на 14:30'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Встреча',
      startTime: '2026-08-12T11:30:00.000Z',
      durationMinutes: null,
    }));
  });

  it('uses H12 consistently in explicit-time Quick Capture', async () => { mockTimeFormat='H12'; renderExplicitTimeCapture(); const selected=new Date('2026-08-12T11:30:00.000Z'); expect(screen.getByText('Выбранное время: 2:30 PM')).toBeTruthy(); fireEvent.changeText(screen.getByLabelText('Название записи'),'Встреча'); const action=screen.getByLabelText('Добавить задачу на 2:30 PM'); expect(screen.getByText('Добавить на 2:30 PM')).toBeTruthy(); fireEvent.press(action); await waitFor(()=>expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({startTime:selected.toISOString()}))); });

  it('can save explicit-time Quick Capture to Thoughts without a start time', async () => {
    renderExplicitTimeCapture();
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Идея  ');
    fireEvent.press(screen.getByText('В Мысли'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Идея',
      startTime: null,
      durationMinutes: null,
    }));
  });

  it('preserves a numeric duration for timed and Thoughts destinations', async () => {
    renderExplicitTimeCapture();
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Timed');
    fireEvent.press(screen.getByText('Добавить на 14:30'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      startTime: expect.any(String), durationMinutes: 45,
    })));

    renderExplicitTimeCapture();
    fireEvent.press(screen.getByLabelText('Длительность 90 мин'));
    fireEvent.changeText(screen.getAllByLabelText('Название записи').at(-1)!, 'Thought');
    fireEvent.press(screen.getAllByText('В Мысли').at(-1)!);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      startTime: null, durationMinutes: 90,
    })));
  });

  it('passes numeric duration to the full form', () => {
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    fireEvent.press(screen.getByLabelText('Длительность 120 мин'));
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ prefillDurationMinutes: '120' }),
    }));
  });

  it('keeps selected duration after a failed creation', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('network'));
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    fireEvent.press(screen.getByLabelText('Длительность 60 мин'));
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Retry me');
    fireEvent.press(screen.getByText('Сохранить в Мысли'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Retry me')).toBeTruthy();
    expect(screen.getByLabelText('Длительность 60 мин').props.accessibilityState).toEqual({ selected: true });
  });

  it('preserves the trimmed title in the full-form prefill', () => {
    render(<GlobalCaptureProvider><TodayScreen /></GlobalCaptureProvider>);
    openGlobalCapture();
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Разобрать почту  ');
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: {
        prefillKind: 'TASK',
        prefillTitle: 'Разобрать почту',
        selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        selectedDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    });
  });

  it('preserves the trimmed title and selected time in full-form prefills', () => {
    renderExplicitTimeCapture();
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Позвонить  ');
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: {
        prefillKind: 'TASK',
        prefillTitle: 'Позвонить',
        prefillStartTime: '2026-08-12T11:30:00.000Z',
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
    fireEvent(screen.getByLabelText('Название записи'), 'submitEditing');
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
  });

  it('disables every creation destination and planning while creation is pending', () => {
    mockMutateAsync.mockReturnValueOnce(new Promise(() => undefined));
    renderExplicitTimeCapture();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Задача');
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
