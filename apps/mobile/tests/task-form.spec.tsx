const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCreateTask = jest.fn();
const mockUpdateTask = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockTimeFormat: 'SYSTEM' | 'H24' | 'H12' = 'H24';
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
  useUpdateTask: () => ({ mutateAsync: mockUpdateTask }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  createSubtask: jest.fn(),
  deleteTaskById: jest.fn(),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ user: { timezone: 'Europe/Moscow', timeFormat: mockTimeFormat } })),
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
    mockTimeFormat = 'H24';
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

  it('creates with a trimmed first step and keeps it after a failed retry', async () => {
    mockCreateTask.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'saved' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderTaskForm();
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Доклад');
    fireEvent.changeText(screen.getByLabelText('Первый маленький шаг'), '  Открыть документ  ');
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByDisplayValue('  Открыть документ  ')).toBeTruthy();
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(mockCreateTask).toHaveBeenLastCalledWith(expect.objectContaining({ firstStep: 'Открыть документ' })));
    alertSpy.mockRestore();
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


describe('TaskFormScreen time convention', () => {
  beforeEach(() => { jest.clearAllMocks(); mockTimeFormat='H12'; mockCreateTask.mockResolvedValue({id:'saved'}); });
  function renderAt(iso: string) { mockParams={selectedDate:iso,prefillStartTime:iso,prefillTitle:'Встреча'}; renderTaskForm(); }
  it.each([['2026-08-11T00:30:00.000Z','12:30 AM'],['2026-08-11T12:30:00.000Z','12:30 PM'],['2026-08-11T14:30:00.000Z','2:30 PM']])('renders %s as %s without exposing 24-hour editor values', (iso,label) => { renderAt(iso); expect(screen.getByTestId('task-time-display').props.children).toBe(label); expect(screen.getByTestId('task-hour-value').props.children).not.toBe('14'); });
  it('switches AM/PM while retaining minutes', () => { renderAt('2026-08-11T14:30:00.000Z'); fireEvent.press(screen.getByRole('radio',{name:'Выбрать AM'})); expect(screen.getByTestId('task-time-display').props.children).toBe('2:30 AM'); expect(screen.getByTestId('task-minute-value').props.children).toBe('30'); fireEvent.press(screen.getByRole('radio',{name:'Выбрать PM'})); expect(screen.getByTestId('task-time-display').props.children).toBe('2:30 PM'); });
  it('saves identical ISO instants for equivalent H12 and H24 choices', async () => { const iso='2026-08-11T14:30:00.000Z'; renderAt(iso); fireEvent.press(screen.getByText('Сохранить')); await waitFor(()=>expect(mockCreateTask).toHaveBeenCalled()); const saved=mockCreateTask.mock.calls[0][0].startTime; screen.unmount(); jest.clearAllMocks(); mockCreateTask.mockResolvedValue({id:'saved'}); mockTimeFormat='H24'; renderAt(iso); fireEvent.press(screen.getByText('Сохранить')); await waitFor(()=>expect(mockCreateTask).toHaveBeenCalled()); expect(mockCreateTask.mock.calls[0][0].startTime).toBe(saved); expect(saved).toBe(iso); });
});
