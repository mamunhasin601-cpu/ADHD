/**
 * Local notification scheduling for task reminders (Package 0011 / ADR-009, corrected in 0011A).
 *
 * ## Channel policy (remote-primary / Task 0011A)
 *
 * - When push registration SUCCEEDS → do NOT schedule local notifications for that task.
 *   The server's BullMQ job handles remote delivery. Local would create a duplicate.
 * - When push registration FAILS or is unavailable → schedule local as fallback.
 * - This prevents the cross-channel duplication found in 0011A finding 7.
 *
 * The `localOnly` flag passed to schedule/reconcile controls this:
 *   localOnly = true  → remote registration failed; use local as the primary channel.
 *   localOnly = false → remote is active; skip local scheduling (no-op).
 *
 * ## Ownership prefix (Task 0011A finding 4)
 *
 * All Focus task-reminder identifiers use the prefix `focus-task-reminder-`.
 * Reconciliation cancels ONLY notifications matching this prefix, not all OS notifications.
 * The prefix is part of the ADR-009 identifier contract.
 */

import * as Notifications from 'expo-notifications';
import type { Task } from '@focus/shared-types';

/** How many days ahead to schedule local reminders on bootstrap. */
export const LOCAL_REMINDER_HORIZON_DAYS = 7;

/** Minimum lead time: skip scheduling if start is fewer ms away than this. */
const MIN_LEAD_MS = 5_000;

/** Identifier prefix for ALL Focus task-reminder local notifications. */
const FOCUS_REMINDER_PREFIX = 'focus-task-reminder-';

/**
 * Returns the deterministic local notification identifier for a task.
 * Uses the `focus-task-reminder-` prefix so reconciliation can identify
 * and cancel only Focus-owned notifications (Task 0011A finding 4).
 */
export function localNotificationId(taskId: string): string {
  return `${FOCUS_REMINDER_PREFIX}${taskId}`;
}

/**
 * Schedule a local notification for a task (local-fallback channel only).
 *
 * Always cancels any pre-existing Focus-owned reminder for this task before
 * returning (0011B fix). This prevents stale local reminders when an
 * installation switches from local-fallback to remote-primary channel.
 *
 * @param task   Task to schedule for.
 * @param localOnly  true = push failed/unavailable, use local as primary.
 *                   false = push is active; cancel stale reminder and skip scheduling.
 */
export async function scheduleLocalReminder(
  task: Task,
  localOnly = true,
): Promise<void> {
  // Always cancel the prior Focus-owned reminder for this task.
  // This handles the switch-to-remote-primary case (0011B blocker 3):
  // a device that was in local-fallback mode may have an existing local
  // notification that must be removed when remote push takes over.
  await cancelLocalReminder(task.id);

  // Remote-primary channel policy: after cleanup, skip scheduling new local notification.
  if (!localOnly) return;

  if (!task.startTime) return;

  const startTime = new Date(task.startTime);
  const now = Date.now();
  const delayMs = startTime.getTime() - now;

  if (delayMs < MIN_LEAD_MS) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: localNotificationId(task.id),
      content: {
        // Generic, non-sensitive (ADR-009): no task title visible on locked screen.
        title: 'Focus',
        body: 'Пора начинать',
        sound: true,
        data: { type: 'task-reminder' }, // no taskId or userId in data
      },
      trigger: {
        date: startTime,
      } as Notifications.DateTriggerInput,
    });
  } catch {
    // Local scheduling failure is non-fatal: task CRUD is unaffected.
  }
}

/**
 * Cancel a scheduled local reminder for a task.
 * Safe to call even if no reminder exists.
 */
export async function cancelLocalReminder(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(localNotificationId(taskId));
  } catch {
    // Not found or already cancelled — not an error.
  }
}

/**
 * Reconcile local reminders with a bounded slice of server tasks.
 *
 * Cancels ONLY Focus-owned task-reminder notifications (identified by the
 * `focus-task-reminder-` prefix). This does NOT cancel unrelated OS notifications
 * such as calendar alerts or other app notifications (Task 0011A finding 4 fix).
 *
 * @param tasks     Bounded list of future tasks from the server (within horizon).
 * @param localOnly If false (push active), no local reminders are scheduled.
 */
export async function reconcileLocalReminders(
  tasks: Task[],
  localOnly = true,
): Promise<void> {
  // Cancel only Focus-owned task-reminder notifications, not ALL OS notifications.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const focusNotifications = scheduled.filter((n) =>
    n.identifier.startsWith(FOCUS_REMINDER_PREFIX),
  );
  await Promise.all(
    focusNotifications.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}),
    ),
  );

  // If push is the primary channel, skip local scheduling entirely.
  if (!localOnly) return;

  const horizon = Date.now() + LOCAL_REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const future = tasks.filter((t) => {
    if (!t.startTime || t.completedAt) return false;
    const ms = new Date(t.startTime).getTime();
    return ms > now + MIN_LEAD_MS && ms <= horizon;
  });

  for (const task of future) {
    await scheduleLocalReminder(task, true);
  }
}

// ── Channel policy module singleton ──────────────────────────────────────────
//
// Tracks whether the current installation is in local-fallback mode
// (localOnly = true) or remote-primary mode (localOnly = false).
//
// Set to true by default so local reminders are scheduled until push
// registration succeeds. _layout.tsx calls setLocalOnlyMode(false) after a
// successful POST /notifications/devices and setLocalOnlyMode(true) on failure.
//
// mutation hooks in tasks.ts read getLocalOnlyMode() before scheduling to
// ensure every task create/update/toggle/delete respects the current channel.

let _localOnlyMode = true;

/**
 * Set the channel policy for this installation.
 * Called from _layout.tsx after push registration attempt.
 *   false = remote-primary (push succeeded; local reminders are a no-op)
 *   true  = local-fallback (push failed/unavailable; schedule local reminders)
 */
export function setLocalOnlyMode(localOnly: boolean): void {
  _localOnlyMode = localOnly;
}

/**
 * Read the current channel policy singleton.
 * Used by mutation hooks to decide whether to schedule local reminders.
 */
export function getLocalOnlyMode(): boolean {
  return _localOnlyMode;
}
