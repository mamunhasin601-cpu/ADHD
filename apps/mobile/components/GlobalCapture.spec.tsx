import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Pressable, Text } from 'react-native';

const mockPush = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetchQueries = jest.fn();
let mockPathname = '/today';
let mockAuthState: any;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ refetchQueries: mockRefetchQueries }),
}));
jest.mock('../lib/api/tasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock('../stores/auth.store', () => {
  const useAuthStore: any = (selector: any) => selector(mockAuthState);
  useAuthStore.getState = () => mockAuthState;
  return { useAuthStore };
});

import { GlobalCaptureProvider, useGlobalCapture } from './GlobalCapture';

function TimelineOpener() {
  const { openTimelineCapture } = useGlobalCapture();
  return <Pressable accessibilityRole="button" accessibilityLabel="Открыть слот" onPress={() => openTimelineCapture({
    instant: new Date('2026-08-15T11:30:00.000Z'),
    selectedDate: new Date('2026-08-14T21:00:00.000Z'),
    selectedDateKey: '2026-08-15',
  })}><Text>slot</Text></Pressable>;
}

function renderOwner(child: React.ReactNode = <Text>tab</Text>) {
  return render(<GlobalCaptureProvider>{child}</GlobalCaptureProvider>);
}
function open() { fireEvent.press(screen.getByLabelText('Добавить запись: задачу, мысль, отдых или буфер')); }
function author(title = 'Новая мысль') {
  fireEvent.changeText(screen.getByLabelText('Название записи'), title);
  fireEvent.press(screen.getByLabelText('Сохранить задачу в Мысли'));
}
function authorTimed(title = 'Время') {
  fireEvent.changeText(screen.getByLabelText('Название записи'), title);
  fireEvent.press(screen.getByLabelText('Добавить задачу на 11:30'));
}
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const freeTierError = { response: { status: 403, data: { code: 'FREE_TIER_LIMIT_REACHED' } } };

describe('GlobalCaptureProvider', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T01:30:00.000Z'));
    mockPathname = '/today';
    mockAuthState = { user: { id: 'A', timezone: 'Europe/Moscow', timeFormat: 'H24' }, sessionGeneration: 7 };
    mockMutateAsync.mockResolvedValue({ id: 'created' });
    mockRefetchQueries.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => { alertSpy.mockRestore(); jest.useRealTimers(); });

  it.each(['/today', '/inbox', '/focus', '/settings'])('owns exactly one accessible action on %s', (tab) => {
    mockPathname = tab;
    renderOwner();
    const actions = screen.getAllByTestId('global-capture-action');
    expect(actions).toHaveLength(1);
    expect(actions[0].props.accessibilityRole).toBe('button');
    expect(actions[0].props.accessibilityState).toEqual(expect.objectContaining({ disabled: false, busy: false }));
  });

  it('uses profile-local current day and device-local invalid-zone fallback', () => {
    mockAuthState.user.timezone = 'America/Los_Angeles';
    const view = renderOwner();
    open();
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));
    expect(mockPush).toHaveBeenLastCalledWith(expect.objectContaining({ params: expect.objectContaining({ selectedDateKey: '2026-08-14', selectedDate: '2026-08-14T07:00:00.000Z' }) }));
    view.unmount();
    mockAuthState.user.timezone = 'Not/AZone';
    renderOwner();
    open();
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));
    expect(mockPush).toHaveBeenLastCalledWith(expect.objectContaining({ params: expect.objectContaining({ selectedDateKey: '2026-08-15' }) }));
  });

  it('keeps rapid double-submit protection and completes one successful Thoughts capture', async () => {
    const create = deferred();
    mockMutateAsync.mockReturnValue(create.promise);
    renderOwner(); open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Купить чай  ');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    const submit = screen.getByLabelText('Сохранить задачу в Мысли');
    fireEvent.press(submit); fireEvent.press(submit);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({ title: 'Купить чай', startTime: null, durationMinutes: 45 });
    await act(async () => create.resolve({ id: 'created' }));
    expect(mockRefetchQueries).toHaveBeenCalledTimes(1);
    expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'inbox'] });
    expect(screen.queryByDisplayValue('  Купить чай  ')).toBeNull();
  });

  it('rejects A -> logout -> A settlement with a new session generation', async () => {
    const create = deferred(); mockMutateAsync.mockReturnValue(create.promise);
    renderOwner(); open(); author('Старое A');
    mockAuthState = { user: null, sessionGeneration: 8 };
    mockAuthState = { user: { id: 'A', timezone: 'Europe/Moscow' }, sessionGeneration: 9 };
    await act(async () => create.resolve({ id: 'old' }));
    expect(mockRefetchQueries).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Старое A')).toBeTruthy();
  });

  it('rejects settlement after owner A changes to B', async () => {
    const create = deferred(); mockMutateAsync.mockReturnValue(create.promise);
    renderOwner(); open(); author();
    mockAuthState = { user: { id: 'B', timezone: 'Europe/Moscow' }, sessionGeneration: 8 };
    await act(async () => create.resolve({ id: 'old' }));
    expect(mockRefetchQueries).not.toHaveBeenCalled();
  });

  it('rejects settlement after provider unmount', async () => {
    const create = deferred(); mockMutateAsync.mockReturnValue(create.promise);
    const view = renderOwner(); open(); author(); view.unmount();
    await act(async () => create.resolve({ id: 'old' }));
    expect(mockRefetchQueries).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invalidates an old operation on tab change without altering newly authored state', async () => {
    const first = deferred(); mockMutateAsync.mockReturnValueOnce(first.promise);
    const view = renderOwner(); open(); author('Старое');
    mockPathname = '/focus';
    view.rerender(<GlobalCaptureProvider><Text>focus</Text></GlobalCaptureProvider>);
    open(); fireEvent.changeText(screen.getByLabelText('Название записи'), 'Новое');
    await act(async () => first.resolve({ id: 'old' }));
    expect(mockRefetchQueries).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Новое')).toBeTruthy();
  });

  it('lets a second valid operation supersede an invalidated earlier operation', async () => {
    const first = deferred(); const second = deferred();
    mockMutateAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = renderOwner(); open(); author('Первое');
    mockPathname = '/inbox'; view.rerender(<GlobalCaptureProvider><Text>inbox</Text></GlobalCaptureProvider>);
    open(); author('Второе');
    await act(async () => second.resolve({ id: 'new' }));
    expect(mockRefetchQueries).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve({ id: 'old' }));
    expect(mockRefetchQueries).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['free-tier', freeTierError],
    ['generic', new Error('offline')],
  ])('suppresses stale %s failure UI', async (_label, error) => {
    const create = deferred(); mockMutateAsync.mockReturnValue(create.promise);
    renderOwner(); open(); author();
    mockAuthState = { user: null, sessionGeneration: 8 };
    await act(async () => create.reject(error));
    expect(mockPush).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('guards before and after inbox refresh and does not begin dated refresh when stale', async () => {
    const inbox = deferred();
    mockRefetchQueries.mockReturnValueOnce(inbox.promise);
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    authorTimed();
    await waitFor(() => expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'inbox'] }));
    mockAuthState = { user: { id: 'B' }, sessionGeneration: 8 };
    await act(async () => inbox.resolve(undefined));
    expect(mockRefetchQueries).toHaveBeenCalledTimes(1);
  });

  it('guards after dated refresh and skips stale UI reset', async () => {
    const dated = deferred();
    mockRefetchQueries.mockResolvedValueOnce(undefined).mockReturnValueOnce(dated.promise);
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    authorTimed();
    await waitFor(() => expect(mockRefetchQueries).toHaveBeenCalledTimes(2));
    mockAuthState = { user: null, sessionGeneration: 8 };
    await act(async () => dated.resolve(undefined));
    expect(screen.getByDisplayValue('Время')).toBeTruthy();
  });

  it('refreshes inbox and the captured dated key before resetting a valid timed capture', async () => {
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    authorTimed();
    await waitFor(() => expect(mockRefetchQueries).toHaveBeenCalledTimes(2));
    expect(mockRefetchQueries.mock.calls).toEqual([
      [{ queryKey: ['tasks', 'inbox'] }],
      [{ queryKey: ['tasks', '2026-08-15'] }],
    ]);
    expect(screen.queryByDisplayValue('Время')).toBeNull();
  });

  it('retains ordinary failure state and routes an owned free-tier failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('offline'));
    renderOwner(); open(); author('Повторить');
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Повторить')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
    open();
    mockMutateAsync.mockRejectedValueOnce(freeTierError);
    author('Лимит');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall'));
  });

  it.each([
    ['Отдых', 'отдыха', 'REST'],
    ['Буфер', 'буфера', 'BUFFER'],
  ])('opens %s in the full form without quick creation and preserves timeline input', (label, labelGenitive, kind) => {
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Переход  ');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    fireEvent.press(screen.getByLabelText(`Открыть полную форму ${labelGenitive}`));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: expect.objectContaining({
        prefillKind: kind,
        prefillTitle: 'Переход',
        prefillStartTime: '2026-08-15T11:30:00.000Z',
        prefillDurationMinutes: '45',
        selectedDateKey: '2026-08-15',
      }),
    });
  });
});
