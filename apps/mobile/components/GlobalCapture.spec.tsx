import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ORBITS_THEMES, OrbitsThemeProvider } from '../theme/orbits';

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

function TodayDateRegistrar() {
  const { setGlobalCaptureDateContext } = useGlobalCapture();
  React.useEffect(() => {
    setGlobalCaptureDateContext({
      selectedDate: new Date('2026-09-29T21:00:00.000Z'),
      selectedDateKey: '2026-09-30',
    });
  }, [setGlobalCaptureDateContext]);
  return <Text>future day</Text>;
}

function renderOwner(child: React.ReactNode = <Text>tab</Text>) {
  return render(<GlobalCaptureProvider>{child}</GlobalCaptureProvider>);
}
function open() { fireEvent.press(screen.getByLabelText('Добавить запись: задачу, мысль или отдых')); }
function author(title = 'Новая мысль') {
  fireEvent.changeText(screen.getByLabelText('Название записи'), title);
  fireEvent.press(screen.getByLabelText('Сохранить задачу в Мысли'));
}
function authorTimed(title = 'Время') {
  fireEvent.changeText(screen.getByLabelText('Название записи'), title);
  fireEvent.press(screen.getByLabelText('Добавить задачу на 14:30'));
}
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function dragEvent(pageX: number, pageY: number, timestamp: number) {
  return { nativeEvent: { pageX, pageY, timestamp } } as any;
}

function startCaptureDrag(dx: number, dy: number, durationMs: number) {
  const region = screen.getByTestId('quick-capture-drag-region', { includeHiddenElements: true });
  const startedAt = 1_000;
  act(() => {
    region.props.onResponderGrant(dragEvent(100, 100, startedAt));
    region.props.onResponderMove(dragEvent(100 + dx, 100 + dy, startedAt + durationMs));
  });
  return { region, endEvent: dragEvent(100 + dx, 100 + dy, startedAt + durationMs) };
}

function finishCaptureDrag(dx: number, dy: number, durationMs: number) {
  const { region, endEvent } = startCaptureDrag(dx, dy, durationMs);
  act(() => region.props.onResponderRelease(endEvent));
  return { region, endEvent };
}

function flushCaptureAnimation() {
  act(() => jest.runAllTimers());
}

function captureTranslateY(): number {
  const style = StyleSheet.flatten(screen.getByTestId('quick-capture-surface').props.style);
  const translateY = style.transform[0].translateY;
  return typeof translateY === 'number' ? translateY : translateY.__getValue();
}

const freeTierError = { response: { status: 403, data: { code: 'FREE_TIER_LIMIT_REACHED' } } };
const occupiedTimeError = { response: { status: 409, data: { code: 'TASK_TIME_SLOT_OCCUPIED' } } };

describe('GlobalCaptureProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T01:30:00.000Z'));
    mockPathname = '/today';
    mockAuthState = { user: { id: 'A', timezone: 'Europe/Moscow', timeFormat: 'H24' }, sessionGeneration: 7 };
    mockMutateAsync.mockResolvedValue({ id: 'created' });
    mockRefetchQueries.mockResolvedValue(undefined);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each(['/today', '/inbox', '/focus', '/settings'])('owns exactly one accessible action on %s', (tab) => {
    mockPathname = tab;
    renderOwner();
    const actions = screen.getAllByTestId('global-capture-action');
    expect(actions).toHaveLength(1);
    expect(actions[0].props.accessibilityRole).toBe('button');
    expect(actions[0].props.accessibilityState).toEqual(expect.objectContaining({ disabled: false, busy: false }));
  });

  it('uses a safe-area-bounded scroll sheet and active theme tokens', () => {
    render(
      <OrbitsThemeProvider theme="dark">
        <GlobalCaptureProvider><Text>tab</Text></GlobalCaptureProvider>
      </OrbitsThemeProvider>,
    );
    open();

    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-surface').props.style)).toEqual(
      expect.objectContaining({
        maxHeight: '100%',
        backgroundColor: ORBITS_THEMES.dark.background,
        borderColor: ORBITS_THEMES.dark.borderSubtle,
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-scrim').props.style)).toEqual(
      expect.objectContaining({ backgroundColor: ORBITS_THEMES.dark.elevationShadow }),
    );
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-drag-handle', { includeHiddenElements: true }).props.style)).toEqual(
      expect.objectContaining({ backgroundColor: ORBITS_THEMES.dark.borderSubtle }),
    );
    const scroll = screen.getByTestId('quick-capture-scroll-view');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.contentContainerStyle).toEqual(expect.objectContaining({ flexGrow: 1 }));
    const input = screen.getByLabelText('Название записи');
    expect(StyleSheet.flatten(input.props.style)).toEqual(expect.objectContaining({
      backgroundColor: ORBITS_THEMES.dark.surfacePrimary,
      borderColor: ORBITS_THEMES.dark.borderSubtle,
      color: ORBITS_THEMES.dark.textPrimary,
    }));
    expect(input.props.placeholderTextColor).toBe(ORBITS_THEMES.dark.textSecondary);
    expect(input.props.selectionColor).toBe(ORBITS_THEMES.dark.brand);
  });

  it('updates the open sheet after a theme change without losing authored fields', () => {
    const view = render(
      <OrbitsThemeProvider theme="warm">
        <GlobalCaptureProvider><Text>tab</Text></GlobalCaptureProvider>
      </OrbitsThemeProvider>,
    );
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Не потерять');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-surface').props.style).backgroundColor).toBe(ORBITS_THEMES.warm.background);
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-drag-handle', { includeHiddenElements: true }).props.style).backgroundColor).toBe(ORBITS_THEMES.warm.borderSubtle);

    view.rerender(
      <OrbitsThemeProvider theme="dark">
        <GlobalCaptureProvider><Text>tab</Text></GlobalCaptureProvider>
      </OrbitsThemeProvider>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-surface').props.style).backgroundColor).toBe(ORBITS_THEMES.dark.background);
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-drag-handle', { includeHiddenElements: true }).props.style).backgroundColor).toBe(ORBITS_THEMES.dark.borderSubtle);
    expect(screen.getByDisplayValue('Не потерять')).toBeTruthy();
    expect(screen.getByLabelText('Длительность 45 мин').props.accessibilityState.selected).toBe(true);
  });

  it('lays duration presets out in three equal adaptive columns', () => {
    renderOwner();
    open();

    const idsInColumn = (column: number) => within(screen.getByTestId(`quick-capture-duration-column-${column}`))
      .getAllByRole('button')
      .map((button) => button.props.testID);

    expect(idsInColumn(1)).toEqual([
      'quick-capture-duration-unknown',
      'quick-capture-duration-45',
      'quick-capture-duration-120',
    ]);
    expect(idsInColumn(2)).toEqual(['quick-capture-duration-15', 'quick-capture-duration-60']);
    expect(idsInColumn(3)).toEqual(['quick-capture-duration-30', 'quick-capture-duration-90']);

    const gridStyle = StyleSheet.flatten(screen.getByTestId('quick-capture-duration-grid').props.style);
    expect(gridStyle).toMatchObject({ flexDirection: 'row', gap: 8 });
    expect(gridStyle.flexWrap).toBeUndefined();
    for (const column of [1, 2, 3]) {
      const columnStyle = StyleSheet.flatten(screen.getByTestId(`quick-capture-duration-column-${column}`).props.style);
      expect(columnStyle).toMatchObject({ flex: 1, gap: 8 });
      expect(columnStyle.width).toBeUndefined();
    }
    for (const preset of ['unknown', '15', '30', '45', '60', '90', '120']) {
      const chipStyle = StyleSheet.flatten(screen.getByTestId(`quick-capture-duration-${preset}`).props.style);
      expect(chipStyle).toMatchObject({
        alignSelf: 'stretch',
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      });
      expect(chipStyle.height).toBeUndefined();
    }
    expect(StyleSheet.flatten(screen.getByText('Не знаю').props.style)).toMatchObject({
      flexShrink: 1,
      textAlign: 'center',
    });
    fireEvent.press(screen.getByTestId('quick-capture-backdrop'));
  });

  it.each([
    [null, 'unknown'],
    [15, '15'],
    [30, '30'],
    [45, '45'],
    [60, '60'],
    [90, '90'],
    [120, '120'],
  ] as const)('preserves duration value %p in the create payload', async (duration, testIDSuffix) => {
    renderOwner();
    open();
    if (duration === null) fireEvent.press(screen.getByTestId('quick-capture-duration-15'));
    fireEvent.press(screen.getByTestId(`quick-capture-duration-${testIDSuffix}`));
    author(`Длительность ${testIDSuffix}`);

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      title: `Длительность ${testIDSuffix}`,
      startTime: null,
      durationMinutes: duration,
    }));
  });

  it.each(['warm', 'dark'] as const)('keeps duration states themed in %s', (name) => {
    const theme = ORBITS_THEMES[name];
    render(
      <OrbitsThemeProvider theme={name}>
        <GlobalCaptureProvider><Text>tab</Text></GlobalCaptureProvider>
      </OrbitsThemeProvider>,
    );
    open();

    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-duration-unknown').props.style)).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-duration-60').props.style)).toMatchObject({
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.borderSubtle,
    });

    const duration60 = screen.UNSAFE_getAllByType(Pressable)
      .find((node) => node.props.testID === 'quick-capture-duration-60');
    expect(StyleSheet.flatten(duration60?.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });

    fireEvent.press(screen.getByTestId('quick-capture-duration-60'));
    expect(screen.getByTestId('quick-capture-duration-60').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('quick-capture-duration-unknown').props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(screen.getByTestId('quick-capture-duration-60').props.style)).toMatchObject({
      backgroundColor: theme.activeSurface,
      borderColor: theme.activeBorder,
    });
    fireEvent.press(screen.getByTestId('quick-capture-backdrop'));
  });

  it('dismisses a sufficient downward drag exactly once without saving, preserves the draft and resets presentation on reopen', () => {
    const keyboardDismiss = jest.spyOn(Keyboard, 'dismiss');
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Не создавать');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    const scrollTo = jest.spyOn(screen.UNSAFE_getByType(ScrollView).instance, 'scrollTo');
    scrollTo.mockClear();
    keyboardDismiss.mockClear();

    const { region, endEvent } = startCaptureDrag(4, 120, 500);
    expect(captureTranslateY()).toBe(120);
    act(() => {
      region.props.onResponderRelease(endEvent);
      region.props.onResponderRelease(endEvent);
    });
    flushCaptureAnimation();

    expect(screen.queryByTestId('quick-capture-modal')).toBeNull();
    expect(keyboardDismiss).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    expect(mockMutateAsync).not.toHaveBeenCalled();

    open();
    act(() => screen.getByTestId('quick-capture-modal').props.onShow());
    expect(screen.getByLabelText('Название записи').props.value).toBe('Не создавать');
    expect(screen.getByLabelText('Длительность 45 мин').props.accessibilityState.selected).toBe(true);
    expect(captureTranslateY()).toBe(0);
    expect(screen.getByTestId('quick-capture-scroll-view').props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('dismisses a short but fast downward swipe without saving', () => {
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Быстрый свайп');

    finishCaptureDrag(2, 32, 20);
    flushCaptureAnimation();

    expect(screen.queryByTestId('quick-capture-modal')).toBeNull();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('restores a short slow drag and preserves title, duration and timeline capture type', () => {
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Сохранить черновик');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));

    const { region, endEvent } = startCaptureDrag(3, 36, 500);
    expect(captureTranslateY()).toBe(36);
    act(() => region.props.onResponderRelease(endEvent));
    flushCaptureAnimation();

    expect(screen.getByTestId('quick-capture-modal')).toBeTruthy();
    expect(captureTranslateY()).toBe(0);
    expect(screen.getByDisplayValue('Сохранить черновик')).toBeTruthy();
    expect(screen.getByLabelText('Длительность 45 мин').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Выбранное время: 14:30')).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['upward', 2, -120, 100],
    ['predominantly horizontal', 140, 60, 60],
  ])('does not dismiss a %s drag', (_label, dx, dy, durationMs) => {
    renderOwner();
    open();

    finishCaptureDrag(dx, dy, durationMs);
    flushCaptureAnimation();

    expect(screen.getByTestId('quick-capture-modal')).toBeTruthy();
    expect(captureTranslateY()).toBe(0);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('explicit Cancel clears the draft without saving', () => {
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Отменить');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));

    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));

    expect(screen.queryByTestId('quick-capture-modal')).toBeNull();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    open();
    expect(screen.getByLabelText('Название записи').props.value).toBe('');
    expect(screen.getByLabelText('Длительность 45 мин').props.accessibilityState.selected).toBe(false);
    expect(captureTranslateY()).toBe(0);
  });

  it.each(['backdrop', 'Android Back'])('%s preserves the draft without creating a record', (method) => {
    renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Не создавать');
    fireEvent.press(screen.getByLabelText('Длительность 60 мин'));
    if (method === 'backdrop') fireEvent.press(screen.getByTestId('quick-capture-backdrop'));
    else act(() => screen.getByTestId('quick-capture-modal').props.onRequestClose());

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('quick-capture-modal')).toBeNull();
    open();
    expect(screen.getByLabelText('Название записи').props.value).toBe('Не создавать');
    expect(screen.getByLabelText('Длительность 60 мин').props.accessibilityState.selected).toBe(true);
  });

  it('clears a private draft when the authenticated owner changes', () => {
    const view = renderOwner();
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Черновик A');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    fireEvent.press(screen.getByTestId('quick-capture-backdrop'));

    mockAuthState = { user: { id: 'B', timezone: 'Europe/Moscow', timeFormat: 'H24' }, sessionGeneration: 8 };
    view.rerender(<GlobalCaptureProvider><Text>tab</Text></GlobalCaptureProvider>);
    open();

    expect(screen.getByLabelText('Название записи').props.value).toBe('');
    expect(screen.getByLabelText('Длительность 45 мин').props.accessibilityState.selected).toBe(false);
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
    expect(mockPush).toHaveBeenLastCalledWith(expect.objectContaining({ params: expect.objectContaining({ selectedDateKey: '2026-08-14' }) }));
  });

  it('passes the selected future Today date through central Add to details while Thoughts stay undated', async () => {
    renderOwner(<TodayDateRegistrar />);
    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Будущая задача');
    fireEvent.press(screen.getByLabelText('Открыть полную форму задачи'));

    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/task-form',
      params: expect.objectContaining({
        prefillTitle: 'Будущая задача',
        selectedDate: '2026-09-29T21:00:00.000Z',
        selectedDateKey: '2026-09-30',
      }),
    });
    expect(mockPush.mock.calls.at(-1)?.[0].params.prefillStartTime).toBeUndefined();

    open();
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Будущая мысль');
    fireEvent.press(screen.getByLabelText('Сохранить задачу в Мысли'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenLastCalledWith({
      title: 'Будущая мысль',
      startTime: null,
      durationMinutes: null,
    }));
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

  it('keeps a timed draft open and explains an occupied time', async () => {
    mockMutateAsync.mockRejectedValue(occupiedTimeError);
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    fireEvent.changeText(screen.getByLabelText('Название записи'), 'Конфликт');
    fireEvent.press(screen.getByLabelText('Добавить задачу на 14:30'));

    expect(await screen.findByText('Это время уже занято')).toBeTruthy();
    expect(screen.getByText('Выберите другое время или измените длительность.')).toBeTruthy();
    expect(screen.getByDisplayValue('Конфликт')).toBeTruthy();
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
    expect(screen.queryByTestId('focus-dialog')).toBeNull();
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
    expect(await screen.findByText('Не удалось создать задачу')).toBeTruthy();
    expect(screen.getByDisplayValue('Повторить')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'ОК' }));
    fireEvent.press(screen.getByLabelText('Отменить быстрое добавление'));
    open();
    mockMutateAsync.mockRejectedValueOnce(freeTierError);
    author('Лимит');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/paywall'));
  });

  it('opens the unified Rest type in the full form without quick creation and preserves timeline input', () => {
    renderOwner(<TimelineOpener />);
    fireEvent.press(screen.getByLabelText('Открыть слот'));
    fireEvent.changeText(screen.getByLabelText('Название записи'), '  Переход  ');
    fireEvent.press(screen.getByLabelText('Длительность 45 мин'));
    expect(screen.queryByText('Буфер')).toBeNull();
    expect(screen.queryByLabelText('Открыть полную форму буфера')).toBeNull();
    fireEvent.press(screen.getByLabelText('Открыть полную форму отдыха'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: expect.objectContaining({
        prefillKind: 'REST',
        prefillTitle: 'Переход',
        prefillStartTime: '2026-08-15T11:30:00.000Z',
        prefillDurationMinutes: '45',
        selectedDateKey: '2026-08-15',
      }),
    });
  });
});
