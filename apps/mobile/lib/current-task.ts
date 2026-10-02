import type { Task } from '@focus/shared-types';
import { derivePlannedTaskStates } from './planned-now-state';

/** Selects current work without inferring or persisting an unknown duration. */
export function findCurrentTask(tasks: Task[], now: Date, dayEnd: Date): Task | null {
  const nowMs = now.getTime();
  return derivePlannedTaskStates(tasks, nowMs, dayEnd.getTime())
    .find(({ state, startMs, endMs }) =>
      (state === 'planned-now' || state === 'started') && startMs <= nowMs && nowMs < endMs,
    )?.task ?? null;
}
