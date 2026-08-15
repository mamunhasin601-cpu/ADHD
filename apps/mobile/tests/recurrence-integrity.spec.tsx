const mockCreate = jest.fn(); const mockUpdate = jest.fn(); const mockAlert = jest.fn();
let mockParams: Record<string, string> = { selectedDateKey: '2026-03-10' };
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockCreate }), useUpdateTask: () => ({ mutateAsync: mockUpdate }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }), createSubtask: jest.fn(), deleteTaskById: jest.fn(),
}));
jest.mock('../stores/auth.store', () => ({ useAuthStore: (selector: any) => selector({ user: { id: 'owner', timezone: 'Europe/Moscow', timeFormat: 'H24' } }) }));
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TaskFormScreen from '../app/task-form';

describe('recurring task form integrity', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(mockAlert); mockParams = { selectedDateKey: '2026-03-10' }; });
  afterEach(() => jest.restoreAllMocks());

  it('exposes recurrence as accessible radios and calmly hides subtasks', () => {
    render(<TaskFormScreen />);
    const daily = screen.getByRole('radio', { name: 'Каждый день' });
    fireEvent.press(daily);
    expect(daily.props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('Шаги пока недоступны для повторяющихся задач.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Добавить шаг')).toBeNull();
  });

  it('preserves the series anchor on a title-only occurrence edit', async () => {
    mockParams.task = JSON.stringify({ id: 'occurrence', seriesId: 'series', title: 'Old', firstStep: null,
      startTime: '2026-03-10T06:15:00Z', seriesStartTime: '2026-03-01T06:15:00Z', seriesTimezone: 'Europe/Moscow',
      seriesRecurrenceRule: 'FREQ=DAILY', recurrenceRule: 'FREQ=DAILY', durationMinutes: 25, color: '#6B5BFC', subTasks: [] });
    mockUpdate.mockResolvedValue({ id: 'series' }); render(<TaskFormScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'New'); fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ dto: expect.objectContaining({
      startTime: '2026-03-01T06:15:00.000Z', editRecurrenceAnchor: false, editRecurrencePattern: false,
    }) })));
    expect(screen.getByText('Изменения применятся ко всему повтору, включая будущие задачи.')).toBeTruthy();
  });

  it('does not allow recurrence selection to silently discard authored subtasks', () => {
    mockParams.task = JSON.stringify({ id: 'task', title: 'Old', firstStep: null, startTime: null,
      recurrenceRule: null, durationMinutes: 25, color: '#6B5BFC', subTasks: [{ id: 'step', title: 'Step' }] });
    render(<TaskFormScreen />); fireEvent.press(screen.getByRole('radio', { name: 'Каждый день' }));
    expect(mockAlert).toHaveBeenCalledWith('Сначала уберите шаги', 'Шаги пока недоступны для повторяющихся задач.');
    expect(screen.getByRole('radio', { name: 'Не повторять' }).props.accessibilityState).toEqual({ selected: true });
  });
});
