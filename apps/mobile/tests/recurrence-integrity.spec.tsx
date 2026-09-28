const mockCreate = jest.fn(); const mockUpdate = jest.fn();
let mockParams: Record<string, string> = { selectedDateKey: '2026-03-10' };
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockCreate }), useUpdateTask: () => ({ mutateAsync: mockUpdate }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }), createSubtask: jest.fn(), deleteTaskById: jest.fn(),
}));
jest.mock('../stores/auth.store', () => ({ useAuthStore: (selector: any) => selector({ user: { id: 'owner', timezone: 'Europe/Moscow', timeFormat: 'H24' } }) }));
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TaskFormScreen from '../app/task-form';

describe('recurring task form integrity', () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams = { selectedDateKey: '2026-03-10' }; });

  it('exposes recurrence as accessible radios and calmly hides subtasks', () => {
    render(<TaskFormScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'Указать время' }));
    const daily = screen.getByRole('radio', { name: 'Каждый день' });
    fireEvent.press(daily);
    expect(screen.getByRole('radio', { name: 'Каждый день' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Части задачи недоступны для повторяющихся задач.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Добавить часть')).toBeNull();
  });

  it('preserves the series anchor when the user explicitly edits the entire series', async () => {
    mockParams.task = JSON.stringify({ id: 'occurrence', seriesId: 'series', title: 'Old', firstStep: null,
      startTime: '2026-03-10T06:15:00Z', seriesStartTime: '2026-03-01T06:15:00Z', seriesTimezone: 'Europe/Moscow',
      seriesRecurrenceRule: 'FREQ=DAILY', recurrenceRule: 'FREQ=DAILY', durationMinutes: 25, color: '#6B5BFC', subTasks: [] });
    mockUpdate.mockResolvedValue({ id: 'series' }); render(<TaskFormScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'Всю серию' }));
    expect(screen.getByRole('radio', { name: 'Остановить весь повтор' })).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'New'); fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ dto: expect.objectContaining({
      startTime: '2026-03-01T06:15:00.000Z', editRecurrenceAnchor: false, editRecurrencePattern: false,
      recurrenceEditScope: 'ENTIRE_SERIES',
    }) })));
    expect(screen.getByText('Изменения применятся ко всему повтору, кроме уже начатых и завершённых событий.')).toBeTruthy();
  });

  it('does not allow recurrence selection to silently discard authored subtasks', () => {
    mockParams.task = JSON.stringify({ id: 'task', title: 'Old', firstStep: null, startTime: null,
      recurrenceRule: null, durationMinutes: 25, color: '#6B5BFC', subTasks: [{ id: 'step', title: 'Step' }] });
    render(<TaskFormScreen />); fireEvent.press(screen.getByRole('radio', { name: 'Указать время' })); fireEvent.press(screen.getByRole('radio', { name: 'Каждый день' }));
    expect(screen.getByText('Сначала уберите части')).toBeTruthy();
    expect(screen.getByText('Части задачи недоступны для повторяющихся задач.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Не повторять' }).props.accessibilityState).toEqual({ selected: true });
  });
});
