const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCreateTask = jest.fn();
const mockUpdateTask = jest.fn();
const mockDeleteTask = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockTimeFormat: 'SYSTEM' | 'H24' | 'H12' = 'H24';
let mockTimezone: string | undefined = 'Europe/Moscow';
let mockParams: Record<string, string> = { selectedDate: '2026-08-11T12:00:00.000Z' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: any) => require('react').createElement('StatusBar', { testID: 'task-form-status-bar', ...props }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockCreateTask }),
  useUpdateTask: () => ({ mutateAsync: mockUpdateTask }),
  useDeleteTask: () => ({ mutateAsync: mockDeleteTask }),
  createSubtask: jest.fn(),
  deleteTaskById: jest.fn(),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ user: { timezone: mockTimezone, timeFormat: mockTimeFormat } })),
}));

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Pressable, StyleSheet } from 'react-native';
import TaskFormScreen from '../app/task-form';
import { ORBITS_THEMES, OrbitsThemeProvider, type OrbitsThemeName } from '../theme/orbits';

function themedTaskForm(theme: OrbitsThemeName) {
  return <OrbitsThemeProvider theme={theme}><TaskFormScreen /></OrbitsThemeProvider>;
}

function renderTaskForm(theme: OrbitsThemeName = 'warm') {
  return render(themedTaskForm(theme));
}

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe('TaskFormScreen create flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { selectedDate: '2026-08-11T12:00:00.000Z' };
    mockTimeFormat = 'H24';
    mockTimezone = 'Europe/Moscow';
  });

  it('defaults new tasks to unknown and sends null', async () => {
    mockCreateTask.mockResolvedValue({ id: 'task-unknown' });
    renderTaskForm();
    expect(screen.getByRole('button', { name: 'Не знаю' }).props.accessibilityState).toEqual({ selected: true });
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Без оценки');
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: null }),
    ));
  });

  it('keeps Save and Delete reachable with keyboard and safe-area inset adjustment', () => {
    renderTaskForm();
    expect(screen.getByTestId('task-form-screen').props).toMatchObject({
      keyboardShouldPersistTaps: 'handled',
      contentInsetAdjustmentBehavior: 'automatic',
      automaticallyAdjustKeyboardInsets: true,
    });
  });

  it('creates with a trimmed first step and keeps it after a failed retry', async () => {
    mockCreateTask.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'saved' });
    renderTaskForm();
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Доклад');
    fireEvent.changeText(screen.getByLabelText('Первый маленький шаг'), '  Открыть документ  ');
    fireEvent.press(screen.getByText('Сохранить'));
    expect(await screen.findByText('Не удалось сохранить')).toBeTruthy();
    expect(screen.getByDisplayValue('  Открыть документ  ')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'ОК' }));
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenLastCalledWith(expect.objectContaining({ firstStep: 'Открыть документ' })));
  });

  it('edits and clears an existing first step to null', async () => {
    mockParams = { ...mockParams, task: JSON.stringify({ id: 'edited', title: 'Edit', firstStep: 'Открыть документ', startTime: null, durationMinutes: null, color: '#6B5BFC', recurrenceRule: null, subTasks: [] }) };
    mockUpdateTask.mockResolvedValue({ id: 'edited' });
    renderTaskForm();
    expect(screen.getByDisplayValue('Открыть документ')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Первый маленький шаг'), '   ');
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'edited', dto: expect.objectContaining({ firstStep: null }) })));
  });

  it('sends an exact numeric preset and preserves numeric prefill', async () => {
    mockParams = { ...mockParams, prefillDurationMinutes: '90' };
    mockCreateTask.mockResolvedValue({ id: 'task-90' });
    renderTaskForm();
    expect(screen.getByRole('button', { name: '90 мин' }).props.accessibilityState).toEqual({ selected: true });
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Оценено');
    fireEvent.press(screen.getByText('45 мин'));
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: 45 }),
    ));
  });

  it.each([[null, 'Не знаю'], [60, '60 мин']])('selects edited duration %p', (duration, label) => {
    mockParams = {
      ...mockParams,
      task: JSON.stringify({
        id: 'edited', title: 'Edit', startTime: null, durationMinutes: duration,
        color: '#6B5BFC', recurrenceRule: null, subTasks: [],
      }),
    };
    renderTaskForm();
    expect(screen.getByRole('button', { name: label }).props.accessibilityState).toEqual({ selected: true });
  });

  it('renders, creates a task, invalidates Today, and returns', async () => {
    mockCreateTask.mockResolvedValue({
      id: 'task-1',
      title: 'Новая задача',
      startTime: null,
      completedAt: null,
  startedAt: null, firstStep: null,
    });
    renderTaskForm();

    act(() => {
      fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Новая задача');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Сохранить'));
    });

    expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Новая задача',
      startTime: null,
    }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 15000);

  it('stays on the form and shows an error when creation fails', async () => {
    mockCreateTask.mockRejectedValue(new Error('network'));
    renderTaskForm();

    act(() => {
      fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Ошибка');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Сохранить'));
    });

    expect(await screen.findByText('Не удалось сохранить')).toBeTruthy();
    expect(screen.getByText('Проверьте соединение и попробуйте снова')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Ошибка')).toBeTruthy();
  }, 15000);

  it('keeps the form open and explains an occupied time on save', async () => {
    mockCreateTask.mockRejectedValue({
      response: { status: 409, data: { code: 'TASK_TIME_SLOT_OCCUPIED' } },
    });
    renderTaskForm();
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Пересечение');
    fireEvent.press(screen.getByText('Указать время'));
    fireEvent.press(screen.getByText('Сохранить'));

    expect(await screen.findByText('Это время уже занято')).toBeTruthy();
    expect(screen.getByText('Выберите другое время или измените длительность.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Пересечение')).toBeTruthy();
  });
});

describe('TaskFormScreen recurring edit scope', () => {
  const occurrence = {
    id: 'occurrence-1',
    userId: 'owner',
    title: 'Повтор',
    firstStep: null,
    startTime: '2026-08-19T14:30:00.000Z',
    durationMinutes: 30,
    color: '#6B5BFC',
    isRecurring: false,
    recurrenceRule: 'FREQ=DAILY',
    seriesId: 'series-1',
    seriesStartTime: '2026-08-01T09:00:00.000Z',
    seriesTimezone: 'UTC',
    seriesRecurrenceRule: 'FREQ=DAILY',
    recurrenceDateKey: '2026-08-19',
    completedAt: null,
    startedAt: null,
    subTasks: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimezone = 'UTC';
    mockTimeFormat = 'H24';
    mockUpdateTask.mockResolvedValue({ id: occurrence.id });
    mockParams = { selectedDateKey: '2026-08-19', task: JSON.stringify(occurrence) };
  });

  it('shows the selected occurrence time and defaults to editing only it', async () => {
    renderTaskForm();

    expect(screen.getByTestId('task-time-display').props.children).toBe('14:30');
    expect(screen.getByTestId('recurrence-scope-only_this').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(screen.getByTestId('task-title-input'), 'Только это');
    fireEvent.press(screen.getByTestId('task-save-button'));

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith(expect.objectContaining({
      id: occurrence.id,
      dto: expect.objectContaining({
        title: 'Только это',
        startTime: occurrence.startTime,
        recurrenceEditScope: 'ONLY_THIS',
      }),
    })));
  });

  it.each([
    ['THIS_AND_FUTURE', 'recurrence-scope-this_and_future', '2026-08-19T15:30:00.000Z'],
    ['ENTIRE_SERIES', 'recurrence-scope-entire_series', '2026-08-01T15:30:00.000Z'],
  ] as const)('anchors a changed wall time correctly for %s', async (scope, testID, expectedStart) => {
    renderTaskForm();
    fireEvent.press(screen.getByTestId(testID));
    fireEvent.press(screen.getByRole('button', { name: 'Увеличить час' }));
    fireEvent.press(screen.getByTestId('task-save-button'));

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith(expect.objectContaining({
      dto: expect.objectContaining({
        recurrenceEditScope: scope,
        editRecurrenceAnchor: true,
        startTime: expectedStart,
      }),
    })));
  });
});

describe('TaskFormScreen record type and duration layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { selectedDateKey: '2026-08-11' };
    mockTimeFormat = 'H24';
    mockTimezone = 'UTC';
    mockCreateTask.mockResolvedValue({ id: 'saved' });
  });

  it('keeps the record type above the title with a deliberate flow-layout interval', () => {
    renderTaskForm();

    expect(styleOf('task-kind-section')).toMatchObject({ marginTop: 4, marginBottom: 16 });
    expect(styleOf('task-kind-group')).toMatchObject({ flexDirection: 'row', gap: 8 });
    expect(screen.getByTestId('task-kind-section').props.style).not.toEqual(expect.objectContaining({ position: 'absolute' }));
    expect(screen.getByTestId('task-kind-task').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('task-kind-rest').props.accessibilityRole).toBe('radio');
    expect(screen.queryByTestId('task-kind-buffer')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Буфер' })).toBeNull();
  });

  it('uses a rounded adaptive title field without the legacy underline and preserves create behavior', async () => {
    renderTaskForm();

    const input = screen.getByTestId('task-title-input');
    expect(styleOf('task-title-input')).toMatchObject({
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    });
    expect(styleOf('task-title-input').borderBottomWidth).toBeUndefined();
    expect(styleOf('task-title-input').borderBottomColor).toBeUndefined();
    expect(styleOf('task-title-input').height).toBeUndefined();
    expect(input.props.autoFocus).toBe(true);

    fireEvent.changeText(input, 'Скруглённое поле');
    expect(screen.getByDisplayValue('Скруглённое поле')).toBeTruthy();
    fireEvent.press(screen.getByTestId('task-save-button'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Скруглённое поле' }),
    ));
  });

  it('lays duration presets out in three equal, stable columns', () => {
    renderTaskForm();

    const labelsInColumn = (column: number) => within(screen.getByTestId(`duration-column-${column}`))
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel);

    expect(labelsInColumn(1)).toEqual(['Не знаю', '45 мин', '120 мин']);
    expect(labelsInColumn(2)).toEqual(['15 мин', '60 мин']);
    expect(labelsInColumn(3)).toEqual(['30 мин', '90 мин']);

    expect(styleOf('duration-grid')).toMatchObject({ flexDirection: 'row', gap: 8 });
    for (const column of [1, 2, 3]) {
      expect(styleOf(`duration-column-${column}`)).toMatchObject({ flex: 1, gap: 8 });
      expect(styleOf(`duration-column-${column}`).width).toBeUndefined();
    }
    for (const preset of ['unknown', '15', '30', '45', '60', '90', '120']) {
      expect(styleOf(`duration-chip-${preset}`)).toMatchObject({
        alignSelf: 'stretch',
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      });
      expect(styleOf(`duration-chip-${preset}`).height).toBeUndefined();
    }
    expect(StyleSheet.flatten(screen.getByText('Не знаю').props.style)).toMatchObject({
      flexShrink: 1,
      textAlign: 'center',
    });
  });

  it.each([
    [null, 'Не знаю'],
    [15, '15 мин'],
    [30, '30 мин'],
    [45, '45 мин'],
    [60, '60 мин'],
    [90, '90 мин'],
    [120, '120 мин'],
  ] as const)('preserves duration value %p when selected and saved', async (duration, label) => {
    renderTaskForm();
    fireEvent.changeText(screen.getByTestId('task-title-input'), `Длительность ${label}`);
    if (duration === null) fireEvent.press(screen.getByTestId('duration-chip-15'));
    fireEvent.press(screen.getByRole('button', { name: label }));
    fireEvent.press(screen.getByTestId('task-save-button'));

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: duration }),
    ));
  });

  it('exposes only TASK and the unified REST choice', () => {
    renderTaskForm();

    fireEvent.press(screen.getByTestId('task-kind-rest'));
    expect(screen.getByTestId('task-kind-rest').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByTestId('task-kind-buffer')).toBeNull();
    fireEvent.press(screen.getByTestId('task-kind-task'));
    expect(screen.getByTestId('task-kind-task').props.accessibilityState.selected).toBe(true);
  });

  it.each(['warm', 'dark'] as const)('keeps duration selected, unselected and pressed states themed in %s', (name) => {
    const theme = ORBITS_THEMES[name];
    renderTaskForm(name);

    expect(styleOf('duration-chip-unknown')).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
    expect(styleOf('duration-chip-60')).toMatchObject({
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.borderSubtle,
    });

    const duration60 = screen.UNSAFE_getAllByType(Pressable)
      .find((node) => node.props.testID === 'duration-chip-60');
    expect(StyleSheet.flatten(duration60?.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });

    fireEvent.press(screen.getByTestId('duration-chip-60'));
    expect(screen.getByTestId('duration-chip-60').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('duration-chip-unknown').props.accessibilityState.selected).toBe(false);
    expect(styleOf('duration-chip-60')).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
  });
});


describe('TaskFormScreen time convention', () => {
  beforeEach(() => { jest.clearAllMocks(); mockTimeFormat='H12'; mockTimezone='UTC'; mockCreateTask.mockResolvedValue({id:'saved'}); });
  function renderAt(iso: string) { mockParams={selectedDate:iso,prefillStartTime:iso,prefillTitle:'Встреча'}; renderTaskForm(); }
  it.each([['2026-08-11T00:30:00.000Z','12:30 AM'],['2026-08-11T12:30:00.000Z','12:30 PM'],['2026-08-11T14:30:00.000Z','2:30 PM']])('renders %s as %s without exposing 24-hour editor values', (iso,label) => { renderAt(iso); expect(screen.getByTestId('task-time-display').props.children).toBe(label); expect(screen.getByTestId('task-hour-value').props.children).not.toBe('14'); });
  it('switches AM/PM while retaining minutes', () => { renderAt('2026-08-11T14:30:00.000Z'); fireEvent.press(screen.getByRole('radio',{name:'Выбрать AM'})); expect(screen.getByTestId('task-time-display').props.children).toBe('2:30 AM'); expect(screen.getByTestId('task-minute-value').props.children).toBe('30'); fireEvent.press(screen.getByRole('radio',{name:'Выбрать PM'})); expect(screen.getByTestId('task-time-display').props.children).toBe('2:30 PM'); });
  it('saves identical ISO instants for equivalent H12 and H24 choices', async () => { const iso='2026-08-11T14:30:00.000Z'; renderAt(iso); fireEvent.press(screen.getByText('Сохранить')); await waitFor(()=>expect(mockCreateTask).toHaveBeenCalled()); const saved=mockCreateTask.mock.calls[0][0].startTime; screen.unmount(); jest.clearAllMocks(); mockCreateTask.mockResolvedValue({id:'saved'}); mockTimeFormat='H24'; renderAt(iso); fireEvent.press(screen.getByText('Сохранить')); await waitFor(()=>expect(mockCreateTask).toHaveBeenCalled()); expect(mockCreateTask.mock.calls[0][0].startTime).toBe(saved); expect(saved).toBe(iso); });
});

describe('TaskFormScreen canonical selected day', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTimeFormat = 'H24';
    mockTimezone = 'Europe/Moscow';
    mockCreateTask.mockResolvedValue({ id: 'saved' });
  });

  it.each([
    ['Europe/Moscow', '2026-08-13', '2026-08-13T11:30:00.000Z'],
    ['America/New_York', '2026-08-13', '2026-08-13T18:30:00.000Z'],
    ['Europe/Moscow', '2027-01-01', '2027-01-01T11:30:00.000Z'],
  ])('creates 14:30 on canonical day in %s', async (timezone, dateKey, expected) => {
    mockTimezone = timezone;
    mockParams = { selectedDateKey: dateKey, selectedDate: `${dateKey}T00:00:00.000Z`, prefillTitle: 'Встреча' };
    renderTaskForm();
    fireEvent.press(screen.getByText('Указать время'));
    while (screen.getByTestId('task-hour-value').props.children !== '14') fireEvent.press(screen.getByLabelText('Увеличить час'));
    while (screen.getByTestId('task-minute-value').props.children !== '30') fireEvent.press(screen.getByLabelText('Увеличить минуты'));
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0].startTime).toBe(expected);
  });

  it.each([undefined, 'Invalid/Timezone'])('uses device-local fallback for %p timezone', async (timezone) => {
    mockTimezone = timezone;
    mockParams = { selectedDateKey: '2026-08-13', prefillStartTime: '2026-08-13T14:30:00.000Z', prefillTitle: 'Fallback' };
    renderTaskForm();
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      startTime: '2026-08-13T14:30:00.000Z',
    })));
  });

  it.each(['prefill', 'edit'])('preserves the exact untouched %s instant when only the title changes', async (mode) => {
    const exact = '2026-08-13T11:32:27.456Z';
    mockParams = mode === 'edit'
      ? { selectedDateKey: '2026-08-13', task: JSON.stringify({ id: 'edited', title: 'Exact', startTime: exact, durationMinutes: null, color: '#6B5BFC', recurrenceRule: null, subTasks: [] }) }
      : { selectedDateKey: '2026-08-13', prefillStartTime: exact, prefillTitle: 'Exact' };
    mockUpdateTask.mockResolvedValue({ id: 'edited' });
    renderTaskForm();
    expect(screen.getByTestId('task-minute-value').props.children).toBe('32');
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Only title changed');
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mode === 'edit' ? mockUpdateTask : mockCreateTask).toHaveBeenCalled());
    const dto = mode === 'edit' ? mockUpdateTask.mock.calls[0][0].dto : mockCreateTask.mock.calls[0][0];
    expect(dto.startTime).toBe(exact);
  });

  it.each(['prefill', 'edit'])('keeps untouched minute 58 valid for %s', async (mode) => {
    const exact = '2026-08-13T11:58:27.456Z';
    mockParams = mode === 'edit'
      ? { selectedDateKey: '2026-08-13', task: JSON.stringify({ id: 'edited', title: 'Exact', startTime: exact, durationMinutes: null, color: '#6B5BFC', recurrenceRule: null, subTasks: [] }) }
      : { selectedDateKey: '2026-08-13', prefillStartTime: exact, prefillTitle: 'Exact' };
    mockUpdateTask.mockResolvedValue({ id: 'edited' });
    renderTaskForm();
    expect(screen.getByTestId('task-minute-value').props.children).toBe('58');
    expect(screen.queryByText('60')).toBeNull();
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mode === 'edit' ? mockUpdateTask : mockCreateTask).toHaveBeenCalled());
    const dto = mode === 'edit' ? mockUpdateTask.mock.calls[0][0].dto : mockCreateTask.mock.calls[0][0];
    expect(dto.startTime).toBe(exact);
  });

  it.each([
    ['minute', 'H24', 'Europe/Moscow', '2026-08-13T11:37:00.000Z'],
    ['hour', 'H24', 'America/New_York', '2026-08-13T19:32:00.000Z'],
    ['meridiem', 'H12', 'Europe/Moscow', '2026-08-12T23:32:00.000Z'],
  ])('rebuilds an explicitly edited %s in profile time', async (control, format, timezone, expected) => {
    mockTimeFormat = format as 'H24' | 'H12';
    mockTimezone = timezone;
    mockParams = { selectedDateKey: '2026-08-13', prefillStartTime: timezone === 'America/New_York' ? '2026-08-13T18:32:27.456Z' : '2026-08-13T11:32:27.456Z', prefillTitle: 'Edited' };
    renderTaskForm();
    if (control === 'minute') fireEvent.press(screen.getByLabelText('Увеличить минуты'));
    if (control === 'hour') fireEvent.press(screen.getByLabelText('Увеличить час'));
    if (control === 'meridiem') fireEvent.press(screen.getByRole('radio', { name: 'Выбрать AM' }));
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0].startTime).toBe(expected);
  });

  it.each(['H12', 'H24'])('does not let %s presentation alter an untouched instant', async (format) => {
    const exact = '2026-08-13T11:32:27.456Z';
    mockTimeFormat = format as 'H12' | 'H24';
    mockParams = { selectedDateKey: '2026-08-13', prefillStartTime: exact, prefillTitle: 'Exact' };
    renderTaskForm();
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0].startTime).toBe(exact);
  });

  it('preserves the exact instant when time is removed and restored without editing', async () => {
    const exact = '2026-08-13T11:32:27.456Z';
    mockParams = { selectedDateKey: '2026-08-13', prefillStartTime: exact, prefillTitle: 'Exact' };
    renderTaskForm();
    fireEvent.press(screen.getByText('Без времени'));
    fireEvent.press(screen.getByText('Указать время'));
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0].startTime).toBe(exact);
  });
});

describe('TaskFormScreen unified rest blocks and legacy BUFFER compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteTask.mockReset();
    mockTimeFormat = 'H24';
    mockTimezone = 'Europe/Moscow';
    mockCreateTask.mockResolvedValue({ id: 'block' });
    mockUpdateTask.mockResolvedValue({ id: 'block' });
  });

  it.each([
    ['REST', 'Europe/Moscow', '2026-08-19T11:30:00.000Z'],
    ['BUFFER', 'America/New_York', '2026-08-19T18:30:00.000Z'],
  ])('creates unified REST from %s prefill with the exact untouched instant and only block fields', async (prefillKind, timezone, exact) => {
    mockTimezone = timezone;
    mockParams = {
      selectedDateKey: '2026-08-19',
      selectedDate: '2026-08-19T00:00:00.000Z',
      prefillKind,
      prefillTitle: 'Пауза',
      prefillStartTime: exact,
      prefillDurationMinutes: '45',
    };
    renderTaskForm();

    expect(screen.queryByLabelText('Первый маленький шаг')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Не знаю' })).toBeNull();
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    expect(mockCreateTask.mock.calls[0][0]).toEqual({
      title: 'Пауза',
      kind: 'REST',
      startTime: exact,
      durationMinutes: 45,
      createRequestId: expect.any(String),
    });
  });

  it('requires known duration and safely falls invalid prefillKind back to TASK', () => {
    mockParams = { selectedDateKey: '2026-08-19', prefillKind: 'EVENT', prefillTitle: 'Legacy' };
    const view = render(<TaskFormScreen />);
    expect(screen.getByRole('radio', { name: 'Задача' }).props.accessibilityState.selected).toBe(true);
    view.unmount();

    mockParams = {
      selectedDateKey: '2026-08-19',
      prefillKind: 'REST',
      prefillTitle: 'Пауза',
      prefillStartTime: '2026-08-19T11:30:00.000Z',
    };
    renderTaskForm();
    expect(screen.getByLabelText('Сохранить отдых').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('alert').props.children).toContain('выберите длительность');
  });

  it('does not discard task-only draft data when changing a new task into a block', () => {
    mockParams = { selectedDateKey: '2026-08-19', prefillTitle: 'Работа' };
    renderTaskForm();
    fireEvent.changeText(screen.getByLabelText('Первый маленький шаг'), 'Открыть документ');
    fireEvent.press(screen.getByRole('radio', { name: 'Отдых' }));

    expect(screen.getByText('Сначала уберите данные задачи')).toBeTruthy();
    expect(screen.getByText(/не удаляем их автоматически/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Задача' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByDisplayValue('Открыть документ')).toBeTruthy();
  });

  it('retains a selected non-default task color and refuses a block kind change', () => {
    mockParams = { selectedDateKey: '2026-08-19', prefillTitle: 'Работа' };
    renderTaskForm();
    fireEvent.press(screen.getByRole('radio', { name: 'Цвет #F97316' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Отдых' }));

    expect(screen.getByText('Сначала уберите данные задачи')).toBeTruthy();
    expect(screen.getByText(/не удаляем их автоматически/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Задача' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('radio', { name: 'Цвет #F97316' }).props.accessibilityState.selected).toBe(true);
  });

  it('retains uncommitted part text and refuses a block kind change', () => {
    mockParams = { selectedDateKey: '2026-08-19', prefillTitle: 'Работа' };
    renderTaskForm();
    fireEvent.changeText(screen.getByLabelText('Новая часть задачи'), '  Черновик части  ');
    fireEvent.press(screen.getByRole('radio', { name: 'Отдых' }));

    expect(screen.getByText('Сначала уберите данные задачи')).toBeTruthy();
    expect(screen.getByText(/не удаляем их автоматически/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Задача' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByDisplayValue('  Черновик части  ')).toBeTruthy();
  });

  it('allows a block kind change when the default task color is untouched', () => {
    mockParams = { selectedDateKey: '2026-08-19', prefillTitle: 'Пауза' };
    renderTaskForm();
    fireEvent.press(screen.getByRole('radio', { name: 'Отдых' }));

    expect(screen.queryByTestId('focus-dialog')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Отдых' }).props.accessibilityState.selected).toBe(true);
  });

  it('displays a legacy BUFFER as Rest and preserves its internal value while editing', async () => {
    const exact = '2026-08-19T11:32:27.456Z';
    mockParams = {
      selectedDateKey: '2026-08-19',
      task: JSON.stringify({
        id: 'buffer', title: 'Пауза', kind: 'BUFFER', startTime: exact,
        durationMinutes: 30, color: '#6B5BFC', recurrenceRule: null, subTasks: [],
      }),
    };
    renderTaskForm();
    expect(screen.getByRole('radio', { name: 'Отдых' }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByRole('radio', { name: 'Буфер' })).toBeNull();
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith({
      id: 'buffer',
      dto: { title: 'Пауза', kind: 'BUFFER', startTime: exact, durationMinutes: 30 },
    }));
  });

  it('disables TASK to block conversion while editing', () => {
    mockParams = {
      selectedDateKey: '2026-08-19',
      task: JSON.stringify({
        id: 'task', title: 'Работа', kind: 'TASK', startTime: null,
        durationMinutes: null, color: '#6B5BFC', recurrenceRule: null, subTasks: [],
      }),
    };
    renderTaskForm();
    expect(screen.getByRole('radio', { name: 'Отдых' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByRole('radio', { name: 'Буфер' })).toBeNull();
  });

  it('returns after a refreshed delete resolves without showing a false error', async () => {
    mockDeleteTask.mockResolvedValue({ affectedOccurrenceIds: ['buffer'] });
    mockParams = {
      selectedDateKey: '2026-08-19',
      task: JSON.stringify({
        id: 'buffer', title: 'Пауза', kind: 'BUFFER', startTime: '2026-08-19T11:30:00.000Z',
        durationMinutes: 30, color: '#6B5BFC', recurrenceRule: null, subTasks: [],
      }),
    };
    renderTaskForm();

    fireEvent.press(screen.getByText('Удалить отдых'));
    expect(await screen.findByText('Удалить отдых?')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith('buffer'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Не удалось удалить')).toBeNull();
  });

  it('shows an error and stays put when the retried delete really rejects', async () => {
    mockDeleteTask.mockRejectedValue({ response: { status: 500 } });
    mockParams = {
      selectedDateKey: '2026-08-19',
      task: JSON.stringify({
        id: 'buffer', title: 'Пауза', kind: 'BUFFER', startTime: '2026-08-19T11:30:00.000Z',
        durationMinutes: 30, color: '#6B5BFC', recurrenceRule: null, subTasks: [],
      }),
    };
    renderTaskForm();

    fireEvent.press(screen.getByText('Удалить отдых'));
    fireEvent.press(await screen.findByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText('Не удалось удалить')).toBeTruthy();
    expect(screen.getByText('Попробуйте снова')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('TaskFormScreen Orbits theming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {
      selectedDateKey: '2026-08-11',
      prefillStartTime: '2026-08-11T14:30:00.000Z',
    };
    mockTimeFormat = 'H24';
    mockTimezone = 'UTC';
  });

  it.each(['warm', 'dark'] as const)('uses %s semantic tokens across the form states', (name) => {
    const theme = ORBITS_THEMES[name];
    renderTaskForm(name);

    expect(styleOf('task-form-screen').backgroundColor).toBe(theme.background);
    expect(styleOf('task-title-input')).toMatchObject({
      color: theme.textPrimary,
      backgroundColor: theme.surfacePrimary,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      borderRadius: 10,
    });
    expect(styleOf('task-title-input').borderBottomWidth).toBeUndefined();
    expect(styleOf('task-title-input').height).toBeUndefined();
    expect(screen.getByTestId('task-title-input').props.placeholderTextColor).toBe(theme.textSecondary);
    expect(styleOf('task-first-step-input')).toMatchObject({
      color: theme.textPrimary,
      backgroundColor: theme.surfacePrimary,
      borderColor: theme.borderSubtle,
    });
    expect(screen.getByTestId('task-first-step-input').props.placeholderTextColor).toBe(theme.textSecondary);
    expect(screen.getByLabelText('Новая часть задачи').props.placeholderTextColor).toBe(theme.textSecondary);
    expect(StyleSheet.flatten(screen.getByText('Тип записи').props.style).color).toBe(theme.textSecondary);
    expect(styleOf('task-kind-task')).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
    expect(styleOf('task-kind-rest')).toMatchObject({
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.borderSubtle,
    });
    expect(styleOf('task-time-timed')).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
    expect(StyleSheet.flatten(screen.getByTestId('task-time-display').props.style).color).toBe(theme.textPrimary);
    expect(StyleSheet.flatten(screen.getByLabelText('Уменьшить час').props.style)).toMatchObject({
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.borderSubtle,
    });
    expect(styleOf('duration-chip-unknown').backgroundColor).toBe(theme.activeSurface);
    expect(styleOf('recurrence-chip-none').backgroundColor).toBe(theme.activeSurface);
    expect(styleOf('task-save-button')).toMatchObject({
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.borderSubtle,
    });
    expect(StyleSheet.flatten(screen.getByText('Сохранить').props.style).color).toBe(theme.textSecondary);
    expect(screen.getByTestId('task-form-status-bar').props.style).toBe(name === 'dark' ? 'light' : 'dark');

    fireEvent.changeText(screen.getByTestId('task-title-input'), 'Тематическая задача');
    expect(styleOf('task-save-button').backgroundColor).toBe(theme.brand);
    expect(StyleSheet.flatten(screen.getByText('Сохранить').props.style).color).toBe(theme.retryText);
    const saveButton = screen.UNSAFE_getAllByType(Pressable).find((node) => node.props.testID === 'task-save-button');
    expect(StyleSheet.flatten(saveButton?.props.style({ pressed: true })).backgroundColor).toBe(theme.brandPressed);
  });

  it.each(['warm', 'dark'] as const)('themes validation, destructive and completion states in %s', (name) => {
    const theme = ORBITS_THEMES[name];
    mockParams = {
      selectedDateKey: '2026-08-11',
      task: JSON.stringify({
        id: 'edit-theme',
        title: 'Редактирование',
        firstStep: null,
        startTime: '2026-08-11T14:30:00.000Z',
        durationMinutes: 30,
        color: '#6B5BFC',
        recurrenceRule: null,
        subTasks: [{ id: 'part-1', title: 'Готовая часть', completedAt: '2026-08-11T15:00:00.000Z' }],
      }),
    };
    renderTaskForm(name);

    expect(StyleSheet.flatten(screen.getByText('Удалить задачу').props.style).color).toBe(theme.errorPrimary);
    const deleteButton = screen.UNSAFE_getAllByType(Pressable).find((node) => node.props.testID === 'task-delete-button');
    expect(StyleSheet.flatten(deleteButton?.props.style({ pressed: true })).backgroundColor).toBe(theme.errorSoft);
    expect(StyleSheet.flatten(screen.getByDisplayValue('Готовая часть').props.style)).toMatchObject({
      color: theme.completionPrimary,
      backgroundColor: theme.completionSoft,
      textDecorationLine: 'line-through',
    });

    const completedPartInput = screen.getByDisplayValue('Готовая часть');
    fireEvent.changeText(completedPartInput, '   ');
    expect(StyleSheet.flatten(completedPartInput.props.style)).toMatchObject({
      borderColor: theme.errorPrimary,
      backgroundColor: theme.errorSoft,
    });
    expect(StyleSheet.flatten(screen.getByRole('alert').props.style).color).toBe(theme.errorPrimary);
  });

  it.each(['warm', 'dark'] as const)('keeps all task swatches as data colors and themes only the selection ring in %s', (name) => {
    const theme = ORBITS_THEMES[name];
    const swatches = ['#6B5BFC', '#F97316', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#84CC16', '#F59E0B'];
    renderTaskForm(name);

    for (const color of swatches) {
      expect(styleOf(`color-swatch-${color}`).backgroundColor).toBe(color);
    }
    expect(styleOf('color-swatch-#6B5BFC').borderColor).toBe(theme.activeBorder);
    expect(styleOf('color-swatch-#F97316').borderColor).toBe(theme.background);
  });

  it('switches warm → dark → warm without losing the timed recurring draft or selected date', async () => {
    mockCreateTask.mockResolvedValue({ id: 'themed-task' });
    const view = renderTaskForm('warm');
    fireEvent.changeText(screen.getByTestId('task-title-input'), 'Черновик темы');
    fireEvent.changeText(screen.getByTestId('task-first-step-input'), 'Открыть документ');
    fireEvent.press(screen.getByTestId('duration-chip-45'));
    fireEvent.press(screen.getByTestId('recurrence-chip-daily'));

    view.rerender(themedTaskForm('dark'));
    expect(screen.getByDisplayValue('Черновик темы')).toBeTruthy();
    expect(screen.getByDisplayValue('Открыть документ')).toBeTruthy();
    expect(screen.getByTestId('duration-chip-45').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('recurrence-chip-daily').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('task-time-display').props.children).toBe('14:30');
    expect(screen.getByTestId('task-kind-task').props.accessibilityState.selected).toBe(true);
    expect(styleOf('task-form-screen').backgroundColor).toBe(ORBITS_THEMES.dark.background);

    view.rerender(themedTaskForm('warm'));
    expect(screen.getByDisplayValue('Черновик темы')).toBeTruthy();
    expect(screen.getByTestId('duration-chip-45').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('recurrence-chip-daily').props.accessibilityState.selected).toBe(true);
    expect(styleOf('task-form-screen').backgroundColor).toBe(ORBITS_THEMES.warm.background);

    fireEvent.press(screen.getByTestId('task-save-button'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Черновик темы',
      durationMinutes: 45,
      kind: 'TASK',
      startTime: '2026-08-11T14:30:00.000Z',
      recurrenceRule: 'FREQ=DAILY',
    })));
  });

  it('uses disabled theme tokens while an async save is in progress', async () => {
    let finishSave: ((value: unknown) => void) | undefined;
    mockCreateTask.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
    renderTaskForm('dark');
    fireEvent.changeText(screen.getByTestId('task-title-input'), 'Сохранение в dark');
    fireEvent.press(screen.getByTestId('task-save-button'));

    expect(await screen.findByText('Сохранение…')).toBeTruthy();
    expect(styleOf('task-save-button')).toMatchObject({
      backgroundColor: ORBITS_THEMES.dark.surfaceMuted,
      borderColor: ORBITS_THEMES.dark.borderSubtle,
    });
    await act(async () => finishSave?.({ id: 'saved' }));
  });

  it('keeps a local subtask draft through a reactive theme update', () => {
    const view = renderTaskForm('warm');
    fireEvent.changeText(screen.getByLabelText('Новая часть задачи'), 'Часть черновика');
    fireEvent.press(screen.getByTestId('subtask-add-button'));

    view.rerender(themedTaskForm('dark'));
    expect(screen.getByDisplayValue('Часть черновика')).toBeTruthy();
    expect(styleOf('task-form-screen').backgroundColor).toBe(ORBITS_THEMES.dark.background);
  });
});
