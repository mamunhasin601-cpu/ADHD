import React from 'react';
import { StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TabsLayout from '../app/(tabs)/_layout';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';
import { useRecoveryUndoHistory } from '../lib/recovery-undo-history';
import { toCanonicalDateParam } from '../lib/timezone';
import { ORBITS_THEMES, OrbitsThemeProvider, type OrbitsThemeName } from '../theme/orbits';

// Real tab bar, Plan, coordinator, actions and query hooks. Only navigation,
// native UI and HTTP boundaries are mocked, not mutations or the shared cache.
const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockOpenGlobalCapture = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Tabs = ({ tabBar }: any) => {
    const [route, setRoute] = React.useState('today');
    const routes = ['today', 'plan', 'progress', 'settings'].map((name) => ({ name, key: name }));
    const Plan = require('../app/(tabs)/plan').default;
    return React.createElement(View, null,
      route === 'plan' ? React.createElement(Plan) : null,
      tabBar({
        state: { routes, index: routes.findIndex((item) => item.name === route) },
        navigation: { navigate: (name: string) => { mockNavigate(name); setRoute(name); } },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    );
  };
  Tabs.Screen = () => null;
  return { Tabs, useRouter: () => ({ push: mockPush }) };
});
jest.mock('../components/GlobalCapture', () => ({
  GlobalCaptureProvider: ({ children }: any) => children,
  useGlobalCapture: () => ({ openGlobalCapture: mockOpenGlobalCapture }),
}));
jest.mock('../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const TZ = 'Europe/Samara';
const task = (id: string) => ({
  id, userId: 'plan-user', title: `Посильная задача ${id}`, kind: 'TASK',
  startTime: '2026-08-01T09:00:00.000Z', durationMinutes: 30,
  completedAt: null, startedAt: null, firstStep: null, isRecurring: false,
  parentTaskId: null, subTasks: [], recurrenceRule: null,
});
let remaining: ReturnType<typeof task>[];
let moved: ReturnType<typeof task>[];
let queryClient: QueryClient;
const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

function tree(theme: OrbitsThemeName = 'warm') {
  return <QueryClientProvider client={queryClient}>
    <OrbitsThemeProvider theme={theme}><TabsLayout /></OrbitsThemeProvider>
  </QueryClientProvider>;
}

function recoveryRequests() {
  return mockGet.mock.calls.filter(([url]) => url === '/tasks/recovery');
}

async function openPlan() {
  await screen.findByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true });
  fireEvent.press(screen.getByTestId('orbits-plan'));
  await screen.findByTestId('recovery-banner');
  await screen.findByText('2 мысли');
}

function selectForInbox(id: string) {
  fireEvent.press(screen.getByTestId(`checkbox-${id}`));
  fireEvent.press(screen.getByTestId(`inbox-btn-${id}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  remaining = [task('one'), task('two')];
  moved = [];
  queryClient = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 },
  } });
  useAuthStore.setState({ user: { id: 'plan-user', timezone: TZ, timeFormat: 'H24' } as any, sessionGeneration: 1 });
  useRecoveryUndoHistory.setState({ entries: [], hydratedUsers: { 'plan-user': true } });
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/tasks/recovery') return { data: { tasks: [...remaining], userTimezone: TZ, localDayStart: '2026-08-02T20:00:00.000Z' } };
    if (url === '/tasks') return { data: [task('thought-one'), task('thought-two')] };
    throw new Error(`Unexpected GET ${url}`);
  });
  mockPost.mockImplementation(async (url: string, payload: any) => {
    if (url === '/tasks/recovery/reschedule') {
      const ids = payload.items.map((item: any) => item.taskId);
      moved = remaining.filter((item) => ids.includes(item.id));
      remaining = remaining.filter((item) => !ids.includes(item.id));
      return { data: { updatedCount: moved.length, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok',
        undoId: 'plan-undo', undoExpiresAt: new Date(Date.now() + 600_000).toISOString() } };
    }
    if (url === '/tasks/recovery/undo') {
      remaining = [...remaining, ...moved];
      return { data: { restoredCount: moved.length, taskRestoreStatus: 'ok', reminderSyncStatus: 'ok', tasks: moved } };
    }
    throw new Error(`Unexpected POST ${url}`);
  });
});

afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    cleanup();
    await queryClient.cancelQueries();
    queryClient.clear();
  });
});

describe('Plan Recovery shared source', () => {
  it('keeps Thoughts, AI and Continue in one scroll without resetting the count on viewing/cancelling', async () => {
    render(tree());
    await openPlan();
    const scroll = screen.getByTestId('plan-content-scroll');
    const sections = within(scroll);
    expect(sections.getByText('Мысли')).toBeTruthy();
    expect(sections.getByText('Подсказки AI')).toBeTruthy();
    const banner = sections.getByTestId('recovery-banner');
    expect(sections.getAllByText('Продолжить · 2')).toHaveLength(1);
    expect(within(banner).getByText('Продолжить · 2')).toBeTruthy();
    expect(within(banner).getByText('Нажмите, чтобы выбрать, что делать дальше')).toBeTruthy();
    expect(banner.props.accessibilityRole).toBe('button');
    expect(sections.queryByTestId('recovery-section-title')).toBeNull();
    expect(sections.getByTestId('recovery-section').props.style).toBeUndefined();
    const collectText = (node: any): string => typeof node === 'string' ? node
      : Array.isArray(node) ? node.map(collectText).join(' ') : collectText(node?.children ?? []);
    const text = collectText(scroll);
    expect(text.indexOf('Мысли')).toBeLessThan(text.indexOf('Подсказки AI'));
    expect(text.indexOf('Подсказки AI')).toBeLessThan(text.indexOf('Продолжить'));
    expect(sections.getByText('Эти разделы пока не показывают выдуманные данные. Добавим их отдельными проверяемыми этапами.')).toBeTruthy();
    expect(await screen.findByText('2 мысли')).toBeTruthy();
    fireEvent.press(screen.getByTestId('plan-thoughts-open'));
    expect(mockPush).toHaveBeenCalledWith('/inbox');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('plan');
    expect(recoveryRequests()).toHaveLength(1);
    expect(recoveryRequests()[0]).toEqual(['/tasks/recovery', { params: { date: toCanonicalDateParam(new Date(), TZ) } }]);
    fireEvent.press(screen.getByTestId('recovery-banner'));
    selectForInbox('one');
    fireEvent.press(screen.getByTestId('cancel-btn'));
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.getByLabelText('План, 2 задач, к которым можно вернуться')).toBeTruthy();
    fireEvent.press(screen.getByTestId('orbits-today'));
    fireEvent.press(screen.getByTestId('orbits-plan'));
    expect(screen.getAllByText('Продолжить · 2')).toHaveLength(1);
    expect(screen.queryByTestId('recovery-section-title')).toBeNull();
    expect(recoveryRequests()).toHaveLength(1);
  });

  it('updates badge and list through real mutation invalidation and Plan Undo', async () => {
    render(tree());
    await openPlan();
    fireEvent.press(screen.getByTestId('recovery-banner'));
    selectForInbox('one');
    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(screen.getByLabelText('План, 1 задач, к которым можно вернуться')).toBeTruthy());
    expect(within(screen.getByTestId('recovery-banner')).getByText('Продолжить · 1')).toBeTruthy();
    expect(screen.queryByTestId('recovery-section-title')).toBeNull();
    expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/reschedule', { items: [{ taskId: 'one', targetStartTime: null }] });
    fireEvent.press(screen.getByTestId('recovery-banner'));
    expect(screen.queryByTestId('task-row-one')).toBeNull();
    expect(screen.getByTestId('task-row-two')).toBeTruthy();
    fireEvent.press(screen.getByTestId('cancel-btn'));
    fireEvent.press(await screen.findByTestId('plan-undo-button-plan-undo'));
    await waitFor(() => expect(screen.getByLabelText('План, 2 задач, к которым можно вернуться')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/undo', { undoId: 'plan-undo' });
    expect(within(screen.getByTestId('recovery-banner')).getByText('Продолжить · 2')).toBeTruthy();
    expect(screen.queryByTestId('recovery-section-title')).toBeNull();
    fireEvent.press(screen.getByTestId('recovery-banner'));
    expect(screen.getByTestId('task-row-one')).toBeTruthy();
  });

  it('removes the card and section chrome without reserving heading space when all tasks are resolved', async () => {
    render(tree());
    await openPlan();
    fireEvent.press(screen.getByTestId('recovery-banner'));
    selectForInbox('one');
    selectForInbox('two');
    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/reschedule', {
      items: [
        { taskId: 'one', targetStartTime: null },
        { taskId: 'two', targetStartTime: null },
      ],
    }));
    await waitFor(() => expect(
      queryClient.getQueryData(['tasks', 'recovery', toCanonicalDateParam(new Date(), TZ)]),
    ).toEqual(expect.objectContaining({ tasks: [] })));
    await waitFor(() => expect(screen.queryByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true })).toBeNull());
    expect(screen.getByTestId('orbits-plan').props.accessibilityLabel).toBe('План');
    expect(screen.queryByTestId('recovery-banner')).toBeNull();
    expect(screen.queryByTestId('recovery-section-title')).toBeNull();
    expect(screen.queryByTestId('recovery-section-empty')).toBeNull();
    expect(screen.queryByText('Здесь пока ничего нет')).toBeNull();
    expect(screen.getByTestId('recovery-section').props.style).toBeUndefined();
    expect(screen.getByTestId('recovery-undo-confirmation')).toBeTruthy();
    expect(queryClient.getQueryData(['tasks', 'recovery', toCanonicalDateParam(new Date(), TZ)])).toEqual(expect.objectContaining({ tasks: [] }));
  });

  it('renders no Recovery card, chrome or empty container for an initially empty shared list', async () => {
    remaining = [];
    render(tree());
    await waitFor(() => expect(recoveryRequests()).toHaveLength(1));
    fireEvent.press(screen.getByTestId('orbits-plan'));
    await screen.findByText('2 мысли');
    expect(screen.queryByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('recovery-section')).toBeNull();
    expect(screen.queryByTestId('recovery-section-title')).toBeNull();
    expect(screen.queryByTestId('recovery-section-empty')).toBeNull();
    expect(screen.queryByText('Здесь пока ничего нет')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('changes theme tokens without changing shared count or Add navigation', async () => {
    const view = render(tree('warm'));
    await openPlan();
    for (const name of ['warm', 'dark'] as const) {
      view.rerender(tree(name));
      expect(StyleSheet.flatten(screen.getByTestId('orbits-plan-recovery-badge', { includeHiddenElements: true }).props.style).backgroundColor).toBe(ORBITS_THEMES[name].rewardSoft);
      expect(StyleSheet.flatten(screen.getByText('Продолжить · 2').props.style).color).toBe(ORBITS_THEMES[name].rewardPrimary);
      expect(screen.queryByTestId('recovery-section-title')).toBeNull();
      expect(screen.getByLabelText('План, 2 задач, к которым можно вернуться')).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('orbits-add'));
    expect(mockOpenGlobalCapture).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
    expect(recoveryRequests()).toHaveLength(1);
  });
});
