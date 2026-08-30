/**
 * RecoverySection integration tests (Task 0006C).
 *
 * These tests render the REAL production Today Recovery coordinator
 * (components/RecoverySection.tsx) together with the REAL production hooks
 * (useOverdueTasks / useRescheduleOverdueTasks), the REAL RecoveryBanner and
 * the REAL PartialReminderNotice, inside a REAL QueryClientProvider.
 *
 * Only boundaries are mocked: HTTP (apiClient), the native date picker, and
 * safe-area. The mutation callback, banner lifecycle, reset logic, notice
 * persistence and cache invalidation are NOT reimplemented in the test.
 */

import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoverySection } from './RecoverySection';
import { apiClient } from '../lib/api-client';
import { getLocalDateString, toCanonicalDateParam } from '../lib/timezone';
import { useAuthStore } from '../stores/auth.store';
import { ORBITS_THEMES, OrbitsThemeProvider, type OrbitsThemeName } from '../theme/orbits';

// ── Boundary mocks ───────────────────────────────────────────────────────────

jest.mock('../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement(View, props, children),
  };
});

let capturedDateOnChange: ((event: any, date?: Date) => void) | null = null;
let capturedTimeOnChange: ((event: any, date?: Date) => void) | null = null;

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: jest.fn(({ onChange, mode, testID }: any) => {
    if (mode === 'date') capturedDateOnChange = onChange;
    if (mode === 'time') capturedTimeOnChange = onChange;
    const { View } = require('react-native');
    const React = require('react');
    return React.createElement(View, { testID: testID || `picker-${mode}` });
  }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TZ = 'Europe/Moscow';

function makeTask(id: string, title: string) {
  return {
    id,
    userId: 'user-1',
    title,
    startTime: new Date('2026-08-03T09:00:00.000Z'),
    completedAt: null,
  startedAt: null, firstStep: null,
    isRecurring: false,
    parentTaskId: null,
    durationMinutes: 30,
    color: '#6B5BFC',
    subTasks: [],
    recurrenceRule: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

const task1 = makeTask('t1', 'Просроченная задача 1');
const task2 = makeTask('t2', 'Просроченная задача 2');

function recoveryResponse(tasks: ReturnType<typeof makeTask>[]) {
  return {
    data: {
      tasks,
      userTimezone: TZ,
      localDayStart: '2026-08-04T21:00:00.000Z',
    },
  };
}

let queryClient: QueryClient | null = null;
let invalidateSpy: jest.SpyInstance;
let unmountTree: (() => void) | null = null;

function renderSection(props?: {
  profileTimezone?: string | null;
  selectedDate?: Date;
  onTimezoneInvalid?: () => void;
  strictMode?: boolean;
  theme?: OrbitsThemeName;
}) {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      // gcTime: 0 is REQUIRED, not cosmetic. TanStack Query v5 defaults
      // mutation gcTime to 5 minutes and schedules a setTimeout to garbage
      // collect each finished mutation. That timer keeps the Jest worker
      // alive long after the tests pass, which is why the suite hung and why
      // --detectOpenHandles reported nothing useful (it is an internal library
      // timer, not a socket or user-land handle).
      mutations: { retry: false, gcTime: 0 },
    },
  });
  invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

  const section = (
    <QueryClientProvider client={queryClient}>
      <RecoverySection
        selectedDate={props?.selectedDate ?? new Date()}
        // `in` check, not `??`/`===undefined`: tests must be able to pass an
        // explicit `undefined` timezone without falling back to the valid TZ.
        profileTimezone={props && 'profileTimezone' in props ? props.profileTimezone : TZ}
        onTimezoneInvalid={props?.onTimezoneInvalid}
      />
    </QueryClientProvider>
  );
  const themedSection = <OrbitsThemeProvider theme={props?.theme ?? 'warm'}>{section}</OrbitsThemeProvider>;
  const utils = render(props?.strictMode ? <React.StrictMode>{themedSection}</React.StrictMode> : themedSection);
  unmountTree = utils.unmount;
  return utils;
}

/**
 * Drains work that the production mutation hook starts but does not await:
 * `invalidateQueries` triggers refetches, and TanStack Query's notifyManager
 * batches subscriber notifications through a timer. Flushing both inside
 * `act(...)` means those rerenders are attributed to the test (no act warning)
 * and no fetch is left in flight when the tree is torn down.
 */
async function flushPendingQueryWork() {
  await act(async () => {
    // Let queued microtasks (fetch resolution, invalidation) settle...
    await Promise.resolve();
    // ...then let the notifyManager's batching timer fire. Real timers are in
    // use here, so a zero-delay macrotask is enough.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Opens the sheet and selects a task with the Inbox destination. */
function selectForInbox(taskId: string) {
  fireEvent.press(screen.getByTestId(`checkbox-${taskId}`));
  fireEvent.press(screen.getByTestId(`inbox-btn-${taskId}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReset();
  mockPost.mockReset();
  capturedDateOnChange = null;
  capturedTimeOnChange = null;
  mockGet.mockResolvedValue(recoveryResponse([task1, task2]));
  useAuthStore.setState({ user: { ...task1, id: 'user-a' } as any, sessionGeneration: 1 });
});

afterEach(async () => {
  // 1. Settle anything the mutation hook started (invalidation → refetch) so
  //    no rerender lands outside act(...) and no fetch resolves post-teardown.
  await flushPendingQueryWork();

  // 2. Unmount the tree → removes query observers and subscriptions.
  unmountTree?.();
  unmountTree = null;

  // 3. Cancel in-flight fetches and drop the dedicated client's caches, then
  //    detach it. Without this the QueryClient keeps the Jest worker alive.
  if (queryClient) {
    await queryClient.cancelQueries();
    queryClient.unmount();
    queryClient.clear();
    queryClient = null;
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RecoverySection — theme surfaces', () => {
  it('uses dark semantic tokens for the timezone-unavailable state', () => {
    renderSection({ profileTimezone: null, theme: 'dark' });
    const state = screen.getByTestId('recovery-timezone-unavailable');
    const flattened = Object.assign({}, ...state.props.style.filter(Boolean));
    expect(flattened.backgroundColor).toBe(ORBITS_THEMES.dark.surfacePrimary);
    expect(flattened.borderColor).toBe(ORBITS_THEMES.dark.borderSubtle);
    const titleStyle = screen.getByText('Часовой пояс не определён').props.style;
    expect(titleStyle[titleStyle.length - 1].color).toBe(ORBITS_THEMES.dark.textPrimary);
  });
});

describe('RecoverySection — banner presence', () => {
  it('does not render the banner when there are no overdue tasks', async () => {
    mockGet.mockResolvedValue(recoveryResponse([]));
    renderSection();

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    // Waiting on the mock call only proves the request was issued; the query's
    // resolution rerender happens afterwards. Flush it inside act(...) so the
    // assertion runs against settled state instead of racing the rerender.
    await flushPendingQueryWork();

    expect(screen.queryByTestId('recovery-banner')).toBeNull();
  });

  it('renders the banner when overdue tasks exist', async () => {
    renderSection();
    // findBy* already waits for the post-resolution render.
    expect(await screen.findByTestId('recovery-banner')).toBeTruthy();
  });

  it('queries recovery with the profile-timezone date param', async () => {
    renderSection();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await flushPendingQueryWork();

    const expectedDate = toCanonicalDateParam(new Date(), TZ);
    expect(mockGet).toHaveBeenCalledWith('/tasks/recovery', {
      params: { date: expectedDate },
    });
  });
});

describe('RecoverySection — open and cancel', () => {
  it('opening and cancelling performs no mutation', async () => {
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));

    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('cancel-btn'));

    expect(mockPost).not.toHaveBeenCalled();
    // Sheet closed and selection cleared: reopening shows no destination.
    fireEvent.press(screen.getByTestId('recovery-banner'));
    expect(screen.queryByTestId(`dest-area-${task1.id}`)).toBeNull();
  });
});

describe('RecoverySection — ok response', () => {
  it('remains owned after StrictMode effect replay and can execute Undo', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'strict-undo', undoExpiresAt: new Date(Date.now() + 600000).toISOString() } })
      .mockResolvedValueOnce({ data: { restoredCount: 1, taskRestoreStatus: 'ok', reminderSyncStatus: 'ok', tasks: [{ id: task1.id, startTime: task1.startTime }] } });
    renderSection({ strictMode: true });
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    fireEvent.press(await screen.findByTestId('recovery-undo-button'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/undo', { undoId: 'strict-undo' }));
  });

  it('keeps an accessible Undo outside the remounted banner and submits once', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-1', undoExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() } })
      .mockResolvedValueOnce({ data: { restoredCount: 1, taskRestoreStatus: 'ok', reminderSyncStatus: 'ok', tasks: [{ id: task1.id, startTime: task1.startTime }] } });
    mockGet.mockResolvedValueOnce(recoveryResponse([task1, task2])).mockResolvedValue(recoveryResponse([task2]));
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    const button = await screen.findByTestId('recovery-undo-button');
    expect(screen.getByTestId('recovery-undo-confirmation')).toBeTruthy();
    fireEvent.press(button);
    fireEvent.press(button);
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/undo', { undoId: 'undo-1' }));
    expect(mockPost.mock.calls.filter(([url]) => url === '/tasks/recovery/undo')).toHaveLength(1);
    await waitFor(() => expect(screen.getByText('Перенос отменён. Задачи возвращены на прежнее место.')).toBeTruthy());
    const keys = invalidateSpy.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    expect(keys).toContain(JSON.stringify(['tasks', 'inbox']));
    expect(keys).toContain(JSON.stringify(['tasks']));
  });

  it('resets submitted state and shows no partial notice', async () => {
    mockPost.mockResolvedValue({
      data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-1', undoExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    });
    mockGet
      .mockResolvedValueOnce(recoveryResponse([task1, task2]))
      .mockResolvedValue(recoveryResponse([task2]));

    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());

    // Submitted state reset → sheet closed (banner remounted).
    await waitFor(() => expect(screen.queryByTestId('confirm-btn')).toBeNull());
    expect(screen.queryByTestId('partial-reminder-notice')).toBeNull();
  });

  it('sends the correct Inbox payload through the production hook', async () => {
    mockPost.mockResolvedValue({
      data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-1', undoExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    });
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/reschedule', {
      items: [{ taskId: task1.id, targetStartTime: null }],
    });
  });

  it('invalidates recovery, today and inbox keys for an Inbox move', async () => {
    mockPost.mockResolvedValue({
      data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-1', undoExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    });
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());

    const dateParam = toCanonicalDateParam(new Date(), TZ);
    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(['tasks', 'recovery', dateParam]));
      expect(keys).toContain(JSON.stringify(['tasks', dateParam]));
      expect(keys).toContain(JSON.stringify(['tasks', 'inbox']));
    });
  });

  it('does not invalidate inbox for a scheduled (non-Inbox) destination', async () => {
    mockPost.mockResolvedValue({
      data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-1', undoExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    });
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    fireEvent.press(screen.getByTestId(`checkbox-${task1.id}`));
    fireEvent.press(screen.getByTestId(`pick-time-btn-${task1.id}`));

    // Device-local picker fields, 3 days ahead at 10:00.
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pickedDate = new Date(
      future.getFullYear(),
      future.getMonth(),
      future.getDate(),
      0,
      0,
      0,
    );
    act(() => capturedDateOnChange?.({ type: 'set' }, pickedDate));

    const pickedTime = new Date(
      future.getFullYear(),
      future.getMonth(),
      future.getDate(),
      10,
      0,
      0,
    );
    act(() => capturedTimeOnChange?.({ type: 'set' }, pickedTime));

    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());

    const payload = mockPost.mock.calls[0][1];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].taskId).toBe(task1.id);
    expect(payload.items[0].targetStartTime).not.toBeNull();
    expect(new Date(payload.items[0].targetStartTime).getTime()).toBeGreaterThan(Date.now());

    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).not.toContain(JSON.stringify(['tasks', 'inbox']));
  });
});

describe('RecoverySection — authenticated replacement', () => {
  it('removes A notice and prevents B from submitting A undo identity', async () => {
    mockPost.mockResolvedValue({ data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-a', undoExpiresAt: new Date(Date.now() + 600000).toISOString() } });
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    expect(await screen.findByTestId('recovery-undo-button')).toBeTruthy();
    act(() => useAuthStore.setState({ user: { ...task1, id: 'user-b' } as any, sessionGeneration: 3 }));
    await waitFor(() => expect(screen.queryByTestId('recovery-undo-confirmation')).toBeNull());
    expect(mockPost.mock.calls.filter(([url]) => url === '/tasks/recovery/undo')).toHaveLength(0);
  });

  it.each(['success', 'error'])('stale Apply %s cannot affect B UI or caches', async (outcome) => {
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    mockPost.mockImplementationOnce(() => new Promise((res, rej) => { resolve = res; reject = rej; }));
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    invalidateSpy.mockClear();
    act(() => useAuthStore.setState({ user: { ...task1, id: 'user-b' } as any, sessionGeneration: 4 }));
    await act(async () => {
      if (outcome === 'success') resolve({ data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'partial', undoId: 'undo-a', undoExpiresAt: new Date(Date.now() + 600000).toISOString() } });
      else reject(new Error('late failure'));
      await Promise.resolve();
    });
    expect(screen.queryByTestId('recovery-undo-confirmation')).toBeNull();
    expect(screen.queryByTestId('partial-reminder-notice')).toBeNull();
    expect(screen.queryByText(/Не удалось перенести/)).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it.each(['success', 'error'])('stale Undo %s cannot affect B UI or caches', async (outcome) => {
    let resolveUndo!: (value: unknown) => void;
    let rejectUndo!: (error: unknown) => void;
    mockPost
      .mockResolvedValueOnce({ data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-a', undoExpiresAt: new Date(Date.now() + 600000).toISOString() } })
      .mockImplementationOnce(() => new Promise((res, rej) => { resolveUndo = res; rejectUndo = rej; }));
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    fireEvent.press(await screen.findByTestId('recovery-undo-button'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/tasks/recovery/undo', { undoId: 'undo-a' }));
    invalidateSpy.mockClear();
    act(() => useAuthStore.setState({ user: { ...task1, id: 'user-b' } as any, sessionGeneration: 5 }));
    await act(async () => {
      if (outcome === 'success') resolveUndo({ data: { restoredCount: 1, taskRestoreStatus: 'ok', reminderSyncStatus: 'partial', tasks: [{ id: task1.id, startTime: task1.startTime }] } });
      else rejectUndo({ response: { data: { code: 'RECOVERY_UNDO_STALE' } } });
      await Promise.resolve();
    });
    expect(screen.queryByTestId('recovery-undo-confirmation')).toBeNull();
    expect(screen.queryByTestId('partial-reminder-notice')).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('RecoverySection — partial response', () => {
  async function submitPartial(remainingAfter: ReturnType<typeof makeTask>[]) {
    mockPost.mockResolvedValue({
      data: {
        updatedCount: 1,
        taskUpdateStatus: 'ok',
        reminderSyncStatus: 'partial',
        failedReminderSyncs: [task1.id],
      },
    });
    mockGet
      .mockResolvedValueOnce(recoveryResponse([task1, task2]))
      .mockResolvedValue(recoveryResponse(remainingAfter));

    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  }

  it('shows the Today-level notice and resets submitted state', async () => {
    await submitPartial([task2]);

    expect(await screen.findByTestId('partial-reminder-notice')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('confirm-btn')).toBeNull());
  });

  it('notice copy makes no automatic-sync promise', async () => {
    await submitPartial([task2]);
    await screen.findByTestId('partial-reminder-notice');

    expect(screen.queryByText(/автоматически/i)).toBeNull();
    expect(screen.queryByText(/следующем соединении/i)).toBeNull();
    expect(screen.getByText(/сохраните время заново/i)).toBeTruthy();
  });

  it('notice contains no task titles or IDs', async () => {
    // Empty remaining list → banner unmounts, so any task title/id still on
    // screen could only come from the notice itself.
    await submitPartial([]);
    const notice = await screen.findByTestId('partial-reminder-notice');

    // Walk the rendered tree collecting text; JSON.stringify would hit
    // circular React internals.
    const collectText = (node: any): string => {
      if (node == null || typeof node === 'boolean') return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(collectText).join(' ');
      if (node.children !== undefined) return collectText(node.children);
      return '';
    };

    const text = collectText(notice);
    expect(text).not.toContain(task1.title);
    expect(text).not.toContain(task1.id);
    expect(text).not.toContain(task2.title);
    // Sanity: the collector actually captured the notice copy.
    expect(text).toContain('Задачи перенесены');
  });

  it('notice stays visible after the query empties and the banner unmounts', async () => {
    await submitPartial([]);

    // Banner unmounts once the recovery query returns an empty list.
    await waitFor(() => expect(screen.queryByTestId('recovery-banner')).toBeNull());
    expect(screen.getByTestId('partial-reminder-notice')).toBeTruthy();
  });

  it('dismissing the notice removes it', async () => {
    await submitPartial([task2]);
    await screen.findByTestId('partial-reminder-notice');

    fireEvent.press(screen.getByTestId('partial-reminder-dismiss'));
    expect(screen.queryByTestId('partial-reminder-notice')).toBeNull();
  });
});

describe('RecoverySection — resubmission safety', () => {
  it('a subset success cannot resubmit a task removed by query invalidation', async () => {
    mockPost.mockResolvedValue({
      data: { updatedCount: 1, taskUpdateStatus: 'ok', reminderSyncStatus: 'ok', undoId: 'undo-1', undoExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    });
    mockGet
      .mockResolvedValueOnce(recoveryResponse([task1, task2]))
      .mockResolvedValue(recoveryResponse([task2]));

    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));

    // Wait for the invalidated query to drop task1.
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(1));

    fireEvent.press(screen.getByTestId('recovery-banner'));
    await waitFor(() => expect(screen.queryByTestId(`task-row-${task1.id}`)).toBeNull());
    expect(screen.getByTestId(`task-row-${task2.id}`)).toBeTruthy();

    // The moved task is unreachable; a second submit can only carry task2.
    selectForInbox(task2.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));

    expect(mockPost.mock.calls[1][1]).toEqual({
      items: [{ taskId: task2.id, targetStartTime: null }],
    });
  });

  it('surfaces a 409 stale-state error without losing the sheet', async () => {
    mockPost.mockRejectedValue({ response: { status: 409 } });
    renderSection();
    fireEvent.press(await screen.findByTestId('recovery-banner'));
    selectForInbox(task1.id);
    fireEvent.press(screen.getByTestId('confirm-btn'));

    expect(await screen.findByTestId('mutation-error-banner')).toBeTruthy();
    expect(screen.getByText(/выберите снова/i)).toBeTruthy();
  });
});

describe('RecoverySection — profile timezone guard', () => {
  it('missing timezone does not call the recovery query and shows the neutral state', async () => {
    renderSection({ profileTimezone: undefined });

    expect(screen.getByTestId('recovery-timezone-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('recovery-banner')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('invalid timezone does not crash and does not call the recovery query', async () => {
    expect(() => renderSection({ profileTimezone: 'Not/AZone' })).not.toThrow();

    expect(screen.getByTestId('recovery-timezone-unavailable')).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('null timezone never schedules in UTC or the device zone', async () => {
    renderSection({ profileTimezone: null });

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recovery-banner')).toBeNull();
  });

  it('offers a profile-settings action when a handler is provided', async () => {
    const onTimezoneInvalid = jest.fn();
    renderSection({ profileTimezone: 'Bad/Zone', onTimezoneInvalid });

    fireEvent.press(screen.getByTestId('recovery-timezone-action'));
    expect(onTimezoneInvalid).toHaveBeenCalledTimes(1);
  });

  it('does not query recovery for a non-today date', async () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    renderSection({ selectedDate: pastDate });

    expect(screen.queryByTestId('recovery-banner')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  // ── F3 regression (Task 0007A finding 4) ──────────────────────────────────
  // Before the fix, !timezoneValid was tested BEFORE !isToday, so an invalid
  // timezone triggered the Recovery-specific neutral state on every historical
  // date — not just on Today. The component must return null on non-Today dates
  // regardless of timezone validity.

  it('historical date + invalid timezone: renders null, NOT the timezone-unavailable state', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    renderSection({ selectedDate: yesterday, profileTimezone: 'Not/AZone' });

    // The recovery-timezone-unavailable state must NOT appear on historical dates.
    expect(screen.queryByTestId('recovery-timezone-unavailable')).toBeNull();
    // The recovery banner must NOT appear either.
    expect(screen.queryByTestId('recovery-banner')).toBeNull();
    // No network request for a historical date.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('historical date + null timezone: renders null, no recovery query', () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    renderSection({ selectedDate: nextWeek, profileTimezone: null });

    expect(screen.queryByTestId('recovery-timezone-unavailable')).toBeNull();
    expect(screen.queryByTestId('recovery-banner')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('Today + invalid timezone: shows neutral recoverable state (NOT null)', () => {
    // On Today with an invalid timezone, the user gets the actionable notice.
    renderSection({ profileTimezone: 'Not/AZone' });

    expect(screen.getByTestId('recovery-timezone-unavailable')).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
