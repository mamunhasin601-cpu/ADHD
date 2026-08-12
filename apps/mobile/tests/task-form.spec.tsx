const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCreateTask = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({ selectedDate: '2026-08-11T12:00:00.000Z' }),
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
  beforeEach(() => jest.clearAllMocks());

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
