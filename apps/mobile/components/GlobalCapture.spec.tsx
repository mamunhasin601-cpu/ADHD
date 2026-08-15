import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockPush = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetchQueries = jest.fn().mockResolvedValue(undefined);
let mockPathname = '/today';
let mockTimezone = 'Europe/Moscow';
let mockPending = false;
let mockSessionGeneration = 7;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: mockRefetchQueries }),
}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockMutateAsync, isPending: mockPending }),
}));
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: any) => selector({
    user: { timezone: mockTimezone, timeFormat: 'H24' },
    sessionGeneration: mockSessionGeneration,
  }),
}));

import { GlobalCaptureProvider } from './GlobalCapture';

function renderOwner(label = 'tab') {
  return render(<GlobalCaptureProvider><Text>{label}</Text></GlobalCaptureProvider>);
}

function open() {
  fireEvent.press(screen.getByLabelText('Добавить задачу'));
}

describe('GlobalCaptureProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T01:30:00.000Z'));
    mockPathname = '/today';
    mockTimezone = 'Europe/Moscow';
    mockPending = false;
    mockSessionGeneration = 7;
    mockMutateAsync.mockResolvedValue({ id: 'created' });
  });
  afterEach(() => jest.useRealTimers());

  it.each(['/today', '/inbox', '/focus', '/settings'])('owns exactly one accessible action on %s', (tab) => {
    mockPathname = tab;
    renderOwner(tab);
    const actions = screen.getAllByTestId('global-capture-action');
    expect(actions).toHaveLength(1);
    expect(actions[0].props.accessibilityRole).toBe('button');
    expect(actions[0].props.accessibilityState).toEqual(expect.objectContaining({ disabled: false, busy: false }));
  });

  it('uses the canonical profile-local current day for non-Today details', () => {
    mockTimezone = 'America/Los_Angeles';
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Идея  ');
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({
      prefillTitle: 'Идея', selectedDateKey: '2026-08-14', selectedDate: '2026-08-14T07:00:00.000Z',
    }) }));
  });

  it('falls back to the device calendar day for an invalid profile timezone', () => {
    mockTimezone = 'Not/AZone';
    renderOwner();
    open();
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({
      selectedDateKey: '2026-08-15',
    }) }));
  });

  it('ignores rapid repeated submit gestures and clears authored state only after success', async () => {
    let resolve!: (value: unknown) => void;
    mockMutateAsync.mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), '  Купить чай  ');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    const submit = screen.getByLabelText('Сохранить задачу в Мысли');
    fireEvent.press(submit);
    fireEvent.press(submit);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({ title: 'Купить чай', startTime: null, durationMinutes: 45 });
    expect(screen.getByDisplayValue('  Купить чай  ')).toBeTruthy();
    await act(async () => { resolve({ id: 'created' }); await Promise.resolve(); });
    expect(screen.queryByDisplayValue('  Купить чай  ')).toBeNull();
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'inbox'] });
  });

  it('retains authored state after an ordinary failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('offline'));
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Повторить');
    fireEvent.press(screen.getByLabelText('Сохранить задачу в Мысли'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(screen.getByDisplayValue('Повторить')).toBeTruthy();
  });

  it('routes the existing free-tier error to the paywall', async () => {
    mockMutateAsync.mockRejectedValueOnce({
      response: { status: 403, data: { code: 'FREE_TIER_LIMIT_REACHED' } },
    });
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название задачи'), 'Лимит');
    fireEvent.press(screen.getByLabelText('Сохранить задачу в Мысли'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall'));
    expect(screen.queryByDisplayValue('Лимит')).toBeNull();
  });
});
