import type { Task } from '@focus/shared-types';
import { isTaskRecord } from './task-kind';

/** Selects current work without inferring or persisting an unknown duration. */
export function findCurrentTask(tasks: Task[], now: Date, dayEnd: Date): Task | null {
  const scheduledPlan = tasks
    .filter((task) => task.startTime && !Number.isNaN(new Date(task.startTime).getTime()))
    .sort(
      (a, b) =>
        new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime(),
    );
  const actionableTasks = scheduledPlan.filter(
    (task) => isTaskRecord(task) && !task.completedAt,
  );
  const nowMs = now.getTime();

  return actionableTasks.find((task) => {
    const start = new Date(task.startTime!).getTime();
    const duration = task.durationMinutes;
    const knownDuration = typeof duration === 'number' &&
      Number.isFinite(duration) && duration > 0
      ? duration
      : null;
    const nextPlanBoundary = scheduledPlan.find(
      (entry) => new Date(entry.startTime!).getTime() > start,
    );
    const end = knownDuration !== null
      ? start + knownDuration * 60 * 1000
      : nextPlanBoundary
        ? new Date(nextPlanBoundary.startTime!).getTime()
        : dayEnd.getTime();
    return start <= nowMs && nowMs < end;
  }) ?? null;
}
