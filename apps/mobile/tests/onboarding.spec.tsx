const mockMutateAsync = jest.fn();

jest.mock('expo-router', () => ({}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: jest.fn(() => ({ mutateAsync: mockMutateAsync })),
}));
jest.mock('../lib/api-client', () => ({ apiClient: { patch: jest.fn() } }));
jest.mock('../stores/auth.store', () => ({ useAuthStore: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../app/onboarding';
import { apiClient } from '../lib/api-client';
import { useCreateTask } from '../lib/api/tasks';
import { useAuthStore } from '../stores/auth.store';

const canonicalTask = {
  id: 'task-1', title: 'Позвонить маме', startTime: '2026-08-15T23:30:00.000Z',
  durationMinutes: null, completedAt: null, startedAt: null,
};
const canonicalUser = { id: 'user-1', hasCompletedOnboarding: true, timezone: 'Pacific/Auckland' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('OnboardingScreen', () => {
  const setUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => selector({
      setUser,
      user: { timezone: 'Pacific/Auckland', timeFormat: 'H24' },
    }));
    mockMutateAsync.mockResolvedValue(canonicalTask);
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: canonicalUser });
  });

  function openIntention() {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Продолжить'));
  }

  it('shows a concise welcome without tutorial, diagnosis marketing, or a feature tour', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText(/одно доступное следующее действие/)).toBeTruthy();
    expect(screen.getByText(/План не должен быть идеальным/)).toBeTruthy();
    expect(screen.getByText('Пока пропустить')).toBeTruthy();
    expect(screen.queryByText(/5 минут/)).toBeNull();
    expect(screen.queryByText(/ADHD/)).toBeNull();
    expect(screen.queryByText('Таймлайн')).toBeNull();
  });

  it('asks only for an accessible title and keeps blank submission disabled', () => {
    openIntention();
    expect(screen.getByLabelText('Название первой задачи')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-time-input')).toBeNull();
    const submit = screen.getByRole('button', { name: 'Добавить на сейчас' });
    expect(submit).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Название первой задачи'), '   ');
    fireEvent(screen.getByLabelText('Название первой задачи'), 'submitEditing');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('captures now once and sends the exact trimmed unknown-duration payload without start-state fields', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T23:30:00.000Z'));
    openIntention();
    fireEvent.changeText(screen.getByLabelText('Название первой задачи'), '  Позвонить маме  ');
    fireEvent.press(screen.getByText('Добавить на сейчас'));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(canonicalUser));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      title: 'Позвонить маме',
      startTime: '2026-08-15T23:30:00.000Z',
      durationMinutes: null,
    });
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('startedAt');
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('completedAt');
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('firstStep');
    expect(useCreateTask).toHaveBeenCalledWith(expect.any(Date), 'Pacific/Auckland');
    jest.useRealTimers();
  });

  it('synchronously guards rapid button and keyboard submissions', async () => {
    const create = deferred<typeof canonicalTask>();
    mockMutateAsync.mockReturnValue(create.promise);
    openIntention();
    const input = screen.getByLabelText('Название первой задачи');
    fireEvent.changeText(input, 'Одна задача');
    fireEvent.press(screen.getByText('Добавить на сейчас'));
    fireEvent.press(screen.getByText('Сохраняем…'));
    fireEvent(input, 'submitEditing');
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
    await act(async () => create.resolve(canonicalTask));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1));
  });

  it('retains the exact entered title and does not complete onboarding after create failure', async () => {
    mockMutateAsync.mockRejectedValue(new Error('offline'));
    openIntention();
    const input = screen.getByLabelText('Название первой задачи');
    fireEvent.changeText(input, '  Мой текст  ');
    fireEvent.press(screen.getByText('Добавить на сейчас'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/попробуйте снова/);
    expect(input.props.value).toBe('  Мой текст  ');
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('retains the canonical task and retries only profile completion', async () => {
    (apiClient.patch as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: canonicalUser });
    openIntention();
    fireEvent.changeText(screen.getByLabelText('Название первой задачи'), 'Позвонить маме');
    fireEvent.press(screen.getByText('Добавить на сейчас'));
    expect(await screen.findByText('Намерение сохранено.')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/переход не завершён/);
    fireEvent.press(screen.getByText('Завершить переход'));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(canonicalUser));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
  });

  it('skips without creating a task and stores only the canonical returned user', async () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Пока пропустить'));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(canonicalUser));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(apiClient.patch).toHaveBeenCalledWith('/users/me', { hasCompletedOnboarding: true });
  });

  it('keeps a failed skip retryable and prevents duplicate profile requests', async () => {
    const patch = deferred<{ data: typeof canonicalUser }>();
    (apiClient.patch as jest.Mock).mockReturnValueOnce(patch.promise).mockResolvedValueOnce({ data: canonicalUser });
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Пока пропустить'));
    fireEvent.press(screen.getByText('Завершаем…'));
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    await act(async () => patch.reject(new Error('offline')));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.press(screen.getByText('Попробовать снова'));
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(canonicalUser));
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('ignores late create settlement after unmount without state-update warnings', async () => {
    const create = deferred<typeof canonicalTask>();
    mockMutateAsync.mockReturnValue(create.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    openIntention();
    fireEvent.changeText(screen.getByLabelText('Название первой задачи'), 'Задача');
    fireEvent.press(screen.getByText('Добавить на сейчас'));
    screen.unmount();
    await act(async () => create.resolve(canonicalTask));
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores late profile rejection after unmount without state-update warnings', async () => {
    const patch = deferred<{ data: typeof canonicalUser }>();
    (apiClient.patch as jest.Mock).mockReturnValue(patch.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Пока пропустить'));
    view.unmount();
    await act(async () => patch.reject(new Error('offline')));
    expect(setUser).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('uses the same current instant at a profile-timezone day boundary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T12:30:00.000Z'));
    openIntention();
    fireEvent.changeText(screen.getByLabelText('Название первой задачи'), 'Новый день');
    fireEvent.press(screen.getByText('Добавить на сейчас'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(mockMutateAsync.mock.calls[0][0].startTime).toBe('2026-08-15T12:30:00.000Z');
    expect(useCreateTask).toHaveBeenCalledWith(expect.any(Date), 'Pacific/Auckland');
    jest.useRealTimers();
  });
});
