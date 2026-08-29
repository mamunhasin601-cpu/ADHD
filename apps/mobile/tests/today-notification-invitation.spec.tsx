const mockPush = jest.fn();
const mockRequestPermission = jest.fn();
let mockTasks: any[] = [];
let mockLoading = false;
let mockError = false;
let mockOnboarding = true;
let mockPermission: 'not-asked' | 'granted' | 'denied' = 'not-asked';
let mockInvitation: 'available' | 'deferred' = 'available';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: jest.fn() }) }));
jest.mock('../lib/notification-lifecycle', () => ({ useNotificationLifecycle: () => ({ permission: mockPermission, invitation: mockInvitation, busy: false, error: null, requestPermission: mockRequestPermission, deferInvitation: jest.fn(), openSettings: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => ({
  useTasksForDate: () => ({ data: mockTasks, isLoading: mockLoading, isError: mockError, refetch: jest.fn(), isRefetching: false }),
  useCreateTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useToggleTask: () => ({ mutate: jest.fn(), isPending: false }),
  useStartTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../stores/auth.store', () => ({ useAuthStore: (selector: any) => selector({ user: { timezone: 'UTC', timeFormat: 'H24', hasCompletedOnboarding: mockOnboarding } }) }));
jest.mock('../components/RecoverySection', () => ({ RecoverySection: () => null }));
jest.mock('../components/ProgressRing', () => ({ ProgressRing: () => null }));
jest.mock('../components/timeline/Timeline', () => ({ Timeline: () => null }));
jest.mock('../components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => { const { View } = require('react-native'); return { SafeAreaView: View }; });

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayScreen from '../app/(tabs)/today';

const task = (durationMinutes: number | null = null) => ({
  id: 'task', userId: 'u', title: 'Первое полезное действие',
  startTime: new Date('2026-08-15T10:00:00Z'), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
});

beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-15T10:05:00Z')); });
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks(); mockTasks = [task()]; mockLoading = false; mockError = false;
  mockOnboarding = true; mockPermission = 'not-asked'; mockInvitation = 'available';
});

it('is absent while tasks are loading', () => {
  mockLoading = true; render(<TodayScreen />);
  expect(screen.queryByText('Хотите получать напоминания?')).toBeNull();
});
it('is absent when the tasks query fails', () => {
  mockError = true; render(<TodayScreen />);
  expect(screen.queryByText('Хотите получать напоминания?')).toBeNull();
});
it('is absent on another profile-local day', () => {
  render(<TodayScreen />);
  fireEvent.press(screen.getAllByText('›')[0]);
  expect(screen.queryByText('Хотите получать напоминания?')).toBeNull();
});
it('is absent when there is no scheduled current or next task', () => {
  mockTasks = [{ ...task(), startTime: null }]; render(<TodayScreen />);
  expect(screen.queryByText('Хотите получать напоминания?')).toBeNull();
});
it('is absent before onboarding completion', () => {
  mockOnboarding = false; render(<TodayScreen />);
  expect(screen.queryByText('Хотите получать напоминания?')).toBeNull();
});
it('is absent after deferral', () => {
  mockInvitation = 'deferred'; render(<TodayScreen />);
  expect(screen.queryByText('Хотите получать напоминания?')).toBeNull();
});
it('appears after the unknown-duration Now Card without requesting automatically', () => {
  render(<TodayScreen />);
  expect(screen.getByText('Хотите получать напоминания?')).toBeTruthy();
  expect(screen.getByText('Начать')).toBeTruthy();
  expect(screen.getByText('Мне трудно начать')).toBeTruthy();
  expect(mockRequestPermission).not.toHaveBeenCalled();
});
