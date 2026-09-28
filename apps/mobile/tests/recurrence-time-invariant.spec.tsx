let mockParams: any = { selectedDateKey: '2026-08-15' };
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../lib/api/tasks', () => ({ useCreateTask: () => ({ mutateAsync: jest.fn() }), useUpdateTask: () => ({ mutateAsync: jest.fn() }), useDeleteTask: () => ({ mutateAsync: jest.fn() }), createSubtask: jest.fn(), deleteTaskById: jest.fn() }));
jest.mock('../stores/auth.store', () => ({ useAuthStore: (selector: any) => selector({ user: { id: 'A', timezone: 'Europe/Moscow', timeFormat: 'H24' } }) }));
import React from 'react'; import { fireEvent, render, screen } from '@testing-library/react-native'; import TaskFormScreen from '../app/task-form';
describe('recurrence time invariant', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('calmly refuses recurrence while the accessible no-time choice is selected', () => {
    render(<TaskFormScreen />); fireEvent.press(screen.getByRole('radio', { name: 'Каждый день' }));
    expect(screen.getByText('Укажите время')).toBeTruthy();
    expect(screen.getByText('Повтору нужно конкретное время начала.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Не повторять' }).props.accessibilityState).toEqual({ selected: true });
  });
  it('explicitly clears recurrence when time is removed', () => {
    render(<TaskFormScreen />); fireEvent.press(screen.getByRole('radio', { name: 'Указать время' })); fireEvent.press(screen.getByRole('radio', { name: 'Каждый день' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Без времени' }));
    expect(screen.getByText('Повтор выключен')).toBeTruthy();
    expect(screen.getByText('Для повторяющейся задачи нужно указать время.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Не повторять' }).props.accessibilityState).toEqual({ selected: true });
  });
});
