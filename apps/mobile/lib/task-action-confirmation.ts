import type { Task, TimeFormat } from '@focus/shared-types';
import { formatClockTime } from './time-format';
import { isValidIANATimezone, toCanonicalDateParam } from './timezone';

type ScheduledTask = Pick<Task, 'startTime' | 'startedAt' | 'completedAt'>;

export function isFutureUnstartedTask(task: ScheduledTask, nowMs: number): boolean {
  if (!task.startTime || task.startedAt || task.completedAt) return false;
  const scheduledMs = new Date(task.startTime).getTime();
  return Number.isFinite(scheduledMs) && scheduledMs > nowMs;
}

export function formatTaskActionSchedule(
  startTime: Date | string,
  nowMs: number,
  timeFormat: TimeFormat,
  profileTimezone?: string | null,
): string {
  const scheduled = new Date(startTime);
  const now = new Date(nowMs);
  const timezone = profileTimezone && isValidIANATimezone(profileTimezone)
    ? profileTimezone
    : undefined;
  const clock = formatClockTime(scheduled, timeFormat, {
    locale: 'ru-RU',
    ...(timezone ? { timeZone: timezone } : {}),
  });
  if (toCanonicalDateParam(scheduled, timezone) === toCanonicalDateParam(now, timezone)) {
    return clock;
  }
  const scheduledYear = Number(toCanonicalDateParam(scheduled, timezone).slice(0, 4));
  const currentYear = Number(toCanonicalDateParam(now, timezone).slice(0, 4));
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(scheduledYear !== currentYear && { year: 'numeric' }),
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(scheduled);
  return `${date}, ${clock}`;
}
