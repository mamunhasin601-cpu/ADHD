const mockMutate = jest.fn();

jest.mock('expo-router', () => ({}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
}));
jest.mock('../lib/api-client', () => ({
  apiClient: { patch: jest.fn() },
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../app/onboarding';
import { apiClient } from '../lib/api-client';
import { useCreateTask } from '../lib/api/tasks';
import { useAuthStore } from '../stores/auth.store';

describe('OnboardingScreen', () => {
  const setUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ setUser, user: { timezone: 'Europe/Moscow' } }),
    );
  });

  it('updates local user and relies on the auth guard after successful completion', async () => {
    const updatedUser = { id: 'u1', hasCompletedOnboarding: true };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedUser });

    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Пропустить'));

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(updatedUser));
    expect(apiClient.patch).toHaveBeenCalledWith('/users/me', {
      hasCompletedOnboarding: true,
    });
  });

  it('stays on onboarding and reports an error when completion fails', async () => {
    (apiClient.patch as jest.Mock).mockRejectedValue(new Error('network'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Пропустить'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByText('Пропустить')).toBeTruthy();
    expect(setUser).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('creates a timed onboarding task in the profile timezone so Today returns it', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-11T12:00:00.000Z'));

    render(<OnboardingScreen />);
    fireEvent.press(screen.getByText('Начать'));
    fireEvent.changeText(screen.getByPlaceholderText('Например: Позвонить маме'), 'Тестовая задача');
    fireEvent.changeText(screen.getByPlaceholderText('14:00'), '14:00');
    fireEvent.press(screen.getByText('Создать'));

    expect(useCreateTask).toHaveBeenCalledWith(expect.any(Date), 'Europe/Moscow');
    expect(mockMutate).toHaveBeenCalledWith(
      {
        title: 'Тестовая задача',
        startTime: '2026-08-11T11:00:00.000Z',
        durationMinutes: 30,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    jest.useRealTimers();
  });
});
