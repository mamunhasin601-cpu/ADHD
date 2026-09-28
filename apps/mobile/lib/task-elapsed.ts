import type { Task } from '@focus/shared-types';

export type TaskElapsedState = {
  elapsedMinutes: number;
  durationMinutes: number;
  overrunMinutes: number;
  ratio: number;
  progress: number;
  overdue: boolean;
};

/** A pure snapshot: callers decide when to refresh it (the UI uses one minute). */
export function getTaskElapsedState(
  task: Pick<Task, 'startedAt' | 'completedAt' | 'durationMinutes'>,
  now: Date,
): TaskElapsedState | null {
  if (!task.startedAt || task.completedAt || !task.durationMinutes || task.durationMinutes <= 0) return null;
  const startedAt = new Date(task.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return null;
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startedAt) / 60_000));
  const ratio = elapsedMinutes / task.durationMinutes;
  return {
    elapsedMinutes,
    durationMinutes: task.durationMinutes,
    overrunMinutes: Math.max(0, elapsedMinutes - task.durationMinutes),
    ratio,
    progress: Math.max(0, Math.min(1, ratio)),
    overdue: ratio > 1,
  };
}

/** Compact Russian duration for long-running explicit starts. */
export function formatElapsedDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
  }
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  return hours ? `${days} д ${hours} ч` : `${days} д`;
}

export function taskElapsedVisualLabel(state: TaskElapsedState): string {
  return state.overdue
    ? `Дольше запланированного · прошло ${formatElapsedDuration(state.elapsedMinutes)}`
    : `Прошло ${state.elapsedMinutes} из ${state.durationMinutes} мин`;
}

export function taskElapsedAccessibilityLabel(state: TaskElapsedState): string {
  return state.overdue
    ? `Задача начата. Дольше запланированного. Всего прошло ${formatElapsedDuration(state.elapsedMinutes)}. ` +
      `План превышен на ${formatElapsedDuration(state.overrunMinutes)}`
    : `Задача начата. Прошло ${state.elapsedMinutes} минут из ${state.durationMinutes}`;
}
