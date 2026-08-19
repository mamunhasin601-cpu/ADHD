import type { Task } from '@focus/shared-types';
import { isTaskRecord } from './task-kind';

/** Selects current work without inferring or persisting an unknown duration. */
export function findCurrentTask(tasks: Task[], now: Date, dayEnd: Date): Task | null {
  const scheduled = tasks
    .filter((task) => isTaskRecord(task) && task.startTime && !task.completedAt)
    .sort(
      (a, b) =>
        new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime(),
    );
  const nowMs = now.getTime();

  return scheduled.find((task, index) => {
    const start = new Date(task.startTime!).getTime();
    const nextStart = scheduled[index + 1]?.startTime
      ? new Date(scheduled[index + 1].startTime!).getTime()
      : dayEnd.getTime();
    const end = task.durationMinutes === null
      ? nextStart
      : start + task.durationMinutes * 60 * 1000;
    return start <= nowMs && nowMs < end;
  }) ?? null;
}
