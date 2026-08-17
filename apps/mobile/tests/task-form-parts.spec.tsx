const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
let mockCreateGuard: (() => boolean) | undefined;
let mockUpdateGuard: (() => boolean) | undefined;
let mockParams: Record<string, string> = { selectedDateKey: '2026-08-17' };
let mockAuth = { user: { id: 'owner', timezone: 'Europe/Moscow', timeFormat: 'H24' }, sessionGeneration: 1 };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: (_date: Date, _timezone: string, guard?: () => boolean) => {
    mockCreateGuard = guard;
    return { mutateAsync: mockCreate };
  },
  useUpdateTask: (_date: Date, _timezone: string, guard?: () => boolean) => {
    mockUpdateGuard = guard;
    return { mutateAsync: mockUpdate };
  },
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: any) => selector(mockAuth),
}));

import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TaskFormScreen from '../app/task-form';

const existingTask = (overrides: any = {}) => ({
  id: 'parent', title: 'Parent', firstStep: null, startTime: null, durationMinutes: null,
  color: '#6B5BFC', recurrenceRule: null, parentTaskId: null, isRecurring: false,
  subTasks: [{ id: 'part-1', title: 'Existing part', completedAt: null }],
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('TaskFormScreen atomic manual parts draft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { user: { id: 'owner', timezone: 'Europe/Moscow', timeFormat: 'H24' }, sessionGeneration: 1 };
    mockCreateGuard = undefined;
    mockUpdateGuard = undefined;
    mockParams = { selectedDateKey: '2026-08-17', task: JSON.stringify(existingTask()) };
  });

  it('keeps add, edit, and completion local, then sends one authoritative update', async () => {
    mockUpdate.mockResolvedValue({ id: 'parent' });
    render(<TaskFormScreen />);

    fireEvent.changeText(screen.getByLabelText('Название части: Existing part'), 'Edited part');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Отметить часть: Edited part' }));
    fireEvent.changeText(screen.getByPlaceholderText('Добавить часть'), '  New part  ');
    fireEvent.press(screen.getByRole('button', { name: 'Добавить часть задачи' }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'parent',
      dto: expect.objectContaining({
        subTasks: [
          { id: 'part-1', title: 'Edited part', completed: true },
          { title: 'New part', completed: false },
        ],
      }),
    });
    expect(mockUpdate.mock.calls[0][0].dto).not.toHaveProperty('createRequestId');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('reuses one create identity for an unchanged failed draft and rotates it after a persisted edit', async () => {
    mockParams = { selectedDateKey: '2026-08-17' };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ id: 'saved' });
    render(<TaskFormScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'New parent');
    fireEvent.changeText(screen.getByPlaceholderText('Добавить часть'), 'Part');
    fireEvent.press(screen.getByRole('button', { name: 'Добавить часть задачи' }));

    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    const firstIdentity = mockCreate.mock.calls[0][0].createRequestId;
    expect(firstIdentity).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
    expect(mockCreate.mock.calls[1][0].createRequestId).toBe(firstIdentity);

    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Changed parent');
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(3));
    expect(mockCreate.mock.calls[2][0].createRequestId).not.toBe(firstIdentity);
    expect(mockBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('keeps remove and add local and performs no write on unmount', () => {
    const view = render(<TaskFormScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Удалить часть: Existing part' }));
    fireEvent.changeText(screen.getByPlaceholderText('Добавить часть'), 'Unsaved');
    fireEvent.press(screen.getByRole('button', { name: 'Добавить часть задачи' }));
    expect(screen.getByDisplayValue('Unsaved')).toBeTruthy();
    view.unmount();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('preserves every field and the identical parts draft after failure for retry', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUpdate.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'parent' });
    render(<TaskFormScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Название задачи'), 'Edited parent');
    fireEvent.changeText(screen.getByLabelText('Название части: Existing part'), 'Retained draft');
    fireEvent.changeText(screen.getByPlaceholderText('Добавить часть'), 'Retry part');
    fireEvent.press(screen.getByRole('button', { name: 'Добавить часть задачи' }));
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());

    expect(screen.getByDisplayValue('Edited parent')).toBeTruthy();
    expect(screen.getByDisplayValue('Retained draft')).toBeTruthy();
    expect(screen.getByDisplayValue('Retry part')).toBeTruthy();
    const firstDto = mockUpdate.mock.calls[0][0];
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    expect(mockUpdate.mock.calls[1][0]).toEqual(firstDto);
    expect(mockBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('blocks a rapid double submit synchronously and exposes busy state', async () => {
    const pending = deferred<any>(); mockUpdate.mockReturnValue(pending.promise);
    render(<TaskFormScreen />);
    const save = screen.getByRole('button', { name: 'Сохранить задачу' });
    fireEvent.press(save); fireEvent.press(save);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Сохранить задачу' }).props.accessibilityState)
      .toMatchObject({ busy: true, disabled: true });
    await act(async () => pending.resolve({ id: 'parent' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('ignores stale success after unmount and stale error after session replacement', async () => {
    const success = deferred<any>(); mockUpdate.mockReturnValueOnce(success.promise);
    const first = render(<TaskFormScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    first.unmount();
    await act(async () => success.resolve({ id: 'parent' }));
    expect(mockBack).not.toHaveBeenCalled();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const failure = deferred<any>(); mockUpdate.mockReturnValueOnce(failure.promise);
    const second = render(<TaskFormScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    mockAuth = { ...mockAuth, sessionGeneration: 2 };
    second.rerender(<TaskFormScreen />);
    await act(async () => failure.reject(new Error('stale')));
    expect(alert).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('guards caches and replacement drafts after task and owner identity changes', async () => {
    const taskChange = deferred<any>();
    mockUpdate.mockReturnValueOnce(taskChange.promise);
    const view = render(<TaskFormScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    expect(mockUpdateGuard?.()).toBe(true);

    mockParams = { ...mockParams, task: JSON.stringify(existingTask({
      id: 'replacement', title: 'Replacement parent',
      subTasks: [{ id: 'replacement-part', title: 'Replacement part', completedAt: null }],
    })) };
    view.rerender(<TaskFormScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Replacement parent')).toBeTruthy());
    expect(screen.getByDisplayValue('Replacement part')).toBeTruthy();
    expect(mockUpdateGuard?.()).toBe(false);
    await act(async () => taskChange.resolve({ id: 'parent' }));
    expect(mockBack).not.toHaveBeenCalled();

    const ownerChange = deferred<any>();
    mockUpdate.mockReturnValueOnce(ownerChange.promise);
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    expect(mockUpdateGuard?.()).toBe(true);
    mockAuth = { user: { ...mockAuth.user, id: 'replacement-owner' }, sessionGeneration: 2 };
    view.rerender(<TaskFormScreen />);
    expect(mockUpdateGuard?.()).toBe(false);
    await act(async () => ownerChange.reject(new Error('stale owner')));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('exposes checked and disabled states for part controls', () => {
    mockParams.task = JSON.stringify(existingTask({
      subTasks: [{ id: 'done', title: 'Completed part', completedAt: '2026-08-17T12:00:00Z' }],
    }));
    render(<TaskFormScreen />);
    expect(screen.getByRole('checkbox', { name: 'Отметить часть: Completed part' }).props.accessibilityState)
      .toEqual({ checked: true, disabled: false });
    expect(screen.getByRole('button', { name: 'Удалить часть: Completed part' }).props.accessibilityState)
      .toEqual({ disabled: false });
  });

  it('keeps an invalid blank edit locally, disables Save, and makes no request', () => {
    render(<TaskFormScreen />);
    fireEvent.changeText(screen.getByLabelText('Название части: Existing part'), '   ');

    expect(screen.getByLabelText('Название части:    ').props.value).toBe('   ');
    expect(screen.getByRole('alert').props.children).toContain('хотя бы один символ');
    expect(screen.getByRole('button', { name: 'Сохранить задачу' }).props.accessibilityState)
      .toMatchObject({ disabled: true, busy: false });
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('accepts exactly 240 title characters and blocks a longer retained draft before the network', async () => {
    mockUpdate.mockResolvedValue({ id: 'parent' });
    const view = render(<TaskFormScreen />);
    const input = screen.getByLabelText('Название части: Existing part');
    fireEvent.changeText(input, 'a'.repeat(240));
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    view.unmount();

    jest.clearAllMocks();
    mockParams.task = JSON.stringify(existingTask({
      subTasks: [{ id: 'long', title: 'b'.repeat(241), completedAt: null }],
    }));
    render(<TaskFormScreen />);
    expect(screen.getByDisplayValue('b'.repeat(241))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить задачу' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('alert').props.children).toContain('240');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('prevents a 51st part, retains its input, and exposes the 44-point add target', () => {
    mockParams.task = JSON.stringify(existingTask({
      subTasks: Array.from({ length: 50 }, (_, index) => ({
        id: `part-${index}`,
        title: `Part ${index + 1}`,
        completedAt: null,
      })),
    }));
    render(<TaskFormScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Добавить часть'), 'Part 51');
    const add = screen.getByRole('button', { name: 'Добавить часть задачи' });

    expect(add.props.accessibilityState).toEqual({ disabled: true });
    expect(StyleSheet.flatten(add.props.style)).toMatchObject({ width: 44, height: 44 });
    expect(screen.getByDisplayValue('Part 51')).toBeTruthy();
    expect(screen.getByRole('alert').props.children).toContain('50');
    fireEvent.press(add);
    expect(screen.queryByDisplayValue('Part 51')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves normally from the live StrictMode setup after effect replay', async () => {
    mockUpdate.mockResolvedValue({ id: 'parent' });
    render(<React.StrictMode><TaskFormScreen /></React.StrictMode>);
    fireEvent.press(screen.getByRole('button', { name: 'Сохранить задачу' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdateGuard?.()).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
