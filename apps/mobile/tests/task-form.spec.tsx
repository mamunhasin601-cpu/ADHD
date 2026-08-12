const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCreateTask = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockParams: Record<string, string> = { selectedDate: '2026-08-11T12:00:00.000Z' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockCreateTask }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  createSubtask: jest.fn(),
  deleteTaskById: jest.fn(),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ user: { timezone: 'Europe/Moscow' } })),
}));

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TaskFormScreen from '../app/task-form';

function renderTaskForm() {
  render(<TaskFormScreen />);
}

describe('TaskFormScreen create flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { selectedDate: '2026-08-11T12:00:00.000Z' };
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
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderTaskForm();

    act(() => {
      fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Ошибка');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Сохранить'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Не удалось сохранить',
      'Проверьте соединение и попробуйте снова',
    ));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Ошибка')).toBeTruthy();
    alertSpy.mockRestore();
  }, 15000);
});
