/**
 * Mobile local notification tests (Task 0011A finding 2).
 *
 * Covers:
 *  - Deterministic identifier with focus-task-reminder- prefix
 *  - scheduleLocalReminder: scheduling, idempotent reschedule, skip when
 *    localOnly=false (remote-primary channel), skip when no startTime or past
 *  - cancelLocalReminder: cancel and safe-no-op when not found
 *  - reconcileLocalReminders: cancels ONLY prefix-matched notifications (not
 *    unrelated OS notifications), bounded 7-day horizon, skip when localOnly=false
 *  - Channel policy singleton: setLocalOnlyMode / getLocalOnlyMode
 */

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import {
  localNotificationId,
  scheduleLocalReminder,
  cancelLocalReminder,
  reconcileLocalReminders,
  setLocalOnlyMode,
  getLocalOnlyMode,
  LOCAL_REMINDER_HORIZON_DAYS,
} from './local-notifications';
import type { Task } from '@focus/shared-types';

const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockGetAll = Notifications.getAllScheduledNotificationsAsync as jest.Mock;

/** Minimal Task fixture. startTime is set to 1 hour from now by default. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-abc',
    userId: 'user-1',
    title: 'Test',
    startTime: new Date(Date.now() + 60 * 60 * 1000), // +1h
    durationMinutes: 30,
    color: '#6B5BFC',
    isRecurring: false,
    recurrenceRule: null,
    parentTaskId: null,
    completedAt: null,
  startedAt: null, firstStep: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSchedule.mockResolvedValue(undefined);
  mockCancel.mockResolvedValue(undefined);
  mockGetAll.mockResolvedValue([]);
  // Reset channel policy to default (local fallback) before each test.
  setLocalOnlyMode(true);
});

// ── localNotificationId ───────────────────────────────────────────────────────

describe('localNotificationId', () => {
  it('returns deterministic identifier with focus-task-reminder- prefix', () => {
    const id = localNotificationId('task-xyz');
    expect(id).toBe('focus-task-reminder-task-xyz');
  });

  it('uses the same prefix for any task id', () => {
    expect(localNotificationId('abc')).toMatch(/^focus-task-reminder-/);
    expect(localNotificationId('def')).toMatch(/^focus-task-reminder-/);
  });
});

// ── Channel policy singleton ──────────────────────────────────────────────────

describe('channel policy singleton', () => {
  it('starts in local-fallback mode (localOnly = true)', () => {
    expect(getLocalOnlyMode()).toBe(true);
  });

  it('setLocalOnlyMode(false) switches to remote-primary', () => {
    setLocalOnlyMode(false);
    expect(getLocalOnlyMode()).toBe(false);
  });

  it('setLocalOnlyMode(true) restores local-fallback', () => {
    setLocalOnlyMode(false);
    setLocalOnlyMode(true);
    expect(getLocalOnlyMode()).toBe(true);
  });
});

// ── scheduleLocalReminder ────────────────────────────────────────────────────

describe('scheduleLocalReminder', () => {
  it('schedules a notification with the deterministic identifier', async () => {
    const task = makeTask({ id: 'task-1' });
    await scheduleLocalReminder(task, true);

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'focus-task-reminder-task-1',
      }),
    );
  });

  it('uses generic non-sensitive content (no task title in payload)', async () => {
    const task = makeTask({ id: 'task-1', title: 'Sensitive: meet client at noon' });
    await scheduleLocalReminder(task, true);

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.title).toBe('Focus');
    expect(call.content.body).not.toMatch(/sensitive|client|noon/i);
    expect(call.content.data).not.toHaveProperty('taskId');
    expect(call.content.data).not.toHaveProperty('userId');
    expect(call.content.data.type).toBe('task-reminder');
  });

  it('is a no-op scheduling when localOnly=false, but DOES cancel stale reminder (0011B blocker 3)', async () => {
    const task = makeTask();
    await scheduleLocalReminder(task, false);

    // Remote-primary: no new local notification scheduled.
    expect(mockSchedule).not.toHaveBeenCalled();
    // But the existing Focus-owned reminder for this task IS cancelled to prevent
    // stale reminders when switching from local-fallback to remote-primary.
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-abc');
  });

  it('is a no-op when task has no startTime', async () => {
    const task = makeTask({ startTime: null });
    await scheduleLocalReminder(task, true);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it.each(['REST', 'BUFFER'] as const)('cancels stale state and never schedules a %s block', async (kind) => {
    const task = makeTask({ id: kind.toLowerCase(), kind });
    await scheduleLocalReminder(task, true);
    expect(mockCancel).toHaveBeenCalledWith(`focus-task-reminder-${kind.toLowerCase()}`);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('skips scheduling when startTime is fewer than 5 s in the future', async () => {
    const task = makeTask({ startTime: new Date(Date.now() + 3_000) });
    await scheduleLocalReminder(task, true);

    // cancel IS called (idempotent cleanup), but schedule is NOT
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-abc');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('cancels prior reminder before scheduling (idempotent reschedule)', async () => {
    const task = makeTask({ id: 'task-r' });
    await scheduleLocalReminder(task, true);

    // cancel called before schedule
    const cancelOrder = mockCancel.mock.invocationCallOrder[0];
    const scheduleOrder = mockSchedule.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(scheduleOrder);
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-r');
  });

  it('does not throw when Notifications.scheduleNotificationAsync rejects', async () => {
    mockSchedule.mockRejectedValue(new Error('OS error'));
    const task = makeTask();
    await expect(scheduleLocalReminder(task, true)).resolves.not.toThrow();
  });
});

// ── cancelLocalReminder ───────────────────────────────────────────────────────

describe('cancelLocalReminder', () => {
  it('calls cancelScheduledNotificationAsync with the correct identifier', async () => {
    await cancelLocalReminder('task-del');
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-del');
  });

  it('does not throw when notification is not found (safe no-op)', async () => {
    mockCancel.mockRejectedValue(new Error('not found'));
    await expect(cancelLocalReminder('task-missing')).resolves.not.toThrow();
  });
});

// ── reconcileLocalReminders ───────────────────────────────────────────────────

describe('reconcileLocalReminders', () => {
  it('keeps backward-compatible behavior when no continuation guard is supplied', async () => {
    mockGetAll.mockResolvedValue([{ identifier: 'focus-task-reminder-existing' }]);
    await reconcileLocalReminders([makeTask({ id: 'new' })], true);
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-existing');
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'focus-task-reminder-new' }),
    );
  });

  it('does not cancel a current-owner reminder when stale ownership ends during OS lookup', async () => {
    let resolveLookup!: (value: any[]) => void;
    mockGetAll.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve; }));
    let current = true;
    const reconciliation = reconcileLocalReminders([], false, () => current);
    current = false;
    resolveLookup([{ identifier: 'focus-task-reminder-user-b' }]);
    await reconciliation;
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cleans up the exact stale notification when scheduling settles after invalidation', async () => {
    let resolveSchedule!: (identifier: string) => void;
    mockSchedule.mockReturnValue(new Promise((resolve) => { resolveSchedule = resolve; }));
    let current = true;
    const reconciliation = reconcileLocalReminders(
      [makeTask({ id: 'user-a' })],
      true,
      () => current,
    );
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    current = false;
    resolveSchedule('focus-task-reminder-user-a');
    await reconciliation;
    expect(mockCancel).toHaveBeenLastCalledWith('focus-task-reminder-user-a');
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('stops between cancellations after ownership changes', async () => {
    mockGetAll.mockResolvedValue([
      { identifier: 'focus-task-reminder-a-1' },
      { identifier: 'focus-task-reminder-b-current' },
    ]);
    let current = true;
    mockCancel.mockImplementationOnce(async () => { current = false; });
    await reconcileLocalReminders([], false, () => current);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalledWith('focus-task-reminder-b-current');
  });

  it('cancels ONLY focus-task-reminder- prefixed notifications (not unrelated ones)', async () => {
    // Mix of Focus-owned and unrelated OS notifications
    mockGetAll.mockResolvedValue([
      { identifier: 'focus-task-reminder-task-1' },
      { identifier: 'focus-task-reminder-task-2' },
      { identifier: 'com.apple.calendar.alarm.123' }, // unrelated — must NOT be cancelled
      { identifier: 'other-app-notification' },         // unrelated — must NOT be cancelled
    ]);

    await reconcileLocalReminders([], true);

    // Only the two Focus-owned reminders are cancelled.
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-1');
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-2');
    expect(mockCancel).not.toHaveBeenCalledWith('com.apple.calendar.alarm.123');
    expect(mockCancel).not.toHaveBeenCalledWith('other-app-notification');
  });

  it('skips scheduling when localOnly=false (remote-primary channel)', async () => {
    mockGetAll.mockResolvedValue([
      { identifier: 'focus-task-reminder-task-1' },
    ]);
    const tasks = [makeTask({ id: 'task-1' })];

    await reconcileLocalReminders(tasks, false);

    // Focus reminders still cancelled (clean slate), but nothing new scheduled.
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-task-1');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('schedules only tasks within the 7-day horizon', async () => {
    const inHorizon = makeTask({
      id: 'near',
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2d
    });
    const beyondHorizon = makeTask({
      id: 'far',
      startTime: new Date(
        Date.now() + (LOCAL_REMINDER_HORIZON_DAYS + 1) * 24 * 60 * 60 * 1000,
      ), // +8d
    });

    await reconcileLocalReminders([inHorizon, beyondHorizon], true);

    const scheduledIds = mockSchedule.mock.calls.map((c) => c[0].identifier);
    expect(scheduledIds).toContain('focus-task-reminder-near');
    expect(scheduledIds).not.toContain('focus-task-reminder-far');
  });

  it('does not schedule completed tasks', async () => {
    const completed = makeTask({
      id: 'done',
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      completedAt: new Date(),
  startedAt: null, firstStep: null,
    });

    await reconcileLocalReminders([completed], true);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not schedule tasks with no startTime', async () => {
    const inbox = makeTask({ id: 'inbox', startTime: null });

    await reconcileLocalReminders([inbox], true);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('excludes blocks during reconciliation while cancelling their stale Focus identifiers', async () => {
    mockGetAll.mockResolvedValue([{ identifier: 'focus-task-reminder-rest' }]);
    await reconcileLocalReminders([makeTask({ id: 'rest', kind: 'REST' })], true);
    expect(mockCancel).toHaveBeenCalledWith('focus-task-reminder-rest');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('handles empty task list gracefully', async () => {
    await expect(reconcileLocalReminders([], true)).resolves.not.toThrow();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
