const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: jest.fn() }),
}));
jest.mock('../lib/api/tasks', () => ({
  useTasksForDate: jest.fn(() => ({ data: [], isLoading: false, isError: false })),
  useCreateTask: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useToggleTask: jest.fn(() => ({ mutate: jest.fn() })),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ user: { timezone: 'Europe/Moscow' } })),
}));
jest.mock('../components/RecoverySection', () => ({ RecoverySection: () => null }));
jest.mock('../components/ProgressRing', () => ({ ProgressRing: () => null }));
jest.mock('../components/timeline/Timeline', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Timeline: ({ tasks }: any) => (
      <View>{tasks.map((task: any) => <Text key={task.id}>{task.title}</Text>)}</View>
    ),
  };
});
jest.mock('../components/EmptyState', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    EmptyState: ({ title, actionLabel, onAction }: any) => (
      <View>
        <Text>{title}</Text>
        <Pressable onPress={onAction}><Text>{actionLabel}</Text></Pressable>
      </View>
    ),
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayScreen from '../app/(tabs)/today';
import { useTasksForDate } from '../lib/api/tasks';

describe('Today empty state Create Task CTA', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens /task-form directly with the selected date', () => {
    render(<TodayScreen />);

    fireEvent.press(screen.getByText('Создать задачу'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: { selectedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
  });

  it('renders a scheduled onboarding task returned by the Today query', () => {
    (useTasksForDate as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'onboarding-task',
          title: 'Тестовая задача',
          startTime: '2026-08-11T11:00:00.000Z',
          completedAt: null,
          durationMinutes: 30,
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<TodayScreen />);

    expect(screen.getByText('Тестовая задача')).toBeTruthy();
  });
});
