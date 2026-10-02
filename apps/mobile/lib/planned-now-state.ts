import type { Task } from '@focus/shared-types';
import { isTaskRecord } from './task-kind';

export type PlannedTaskPresentationState =
  | 'completed'
  | 'started'
  | 'planned-now'
  | 'not-started'
  | 'upcoming';

export interface PlannedTaskState {
  task: Task;
  state: PlannedTaskPresentationState;
  startMs: number;
  endMs: number;
}

function validStartMs(task: Task): number | null {
  if (!task.startTime) return null;
  const value = new Date(task.startTime).getTime();
  return Number.isFinite(value) ? value : null;
}

function isTechnicalRecurrenceTemplate(task: Task): boolean {
  return task.isRecurring && !task.seriesId;
}

/**
 * Derives Today presentation from canonical task data without creating a
 * lifecycle state. Known durations own [start, end); an unknown/non-positive
 * duration ends at the next plan boundary or the supplied day boundary.
 */
export function derivePlannedTaskStates(
  tasks: Task[],
  nowMs: number,
  dayEndMs: number,
): PlannedTaskState[] {
  const plan = tasks
    .flatMap((task) => {
      if (isTechnicalRecurrenceTemplate(task)) return [];
      const startMs = validStartMs(task);
      return startMs === null ? [] : [{ task, startMs }];
    })
    .sort((left, right) => left.startMs - right.startMs || left.task.id.localeCompare(right.task.id));

  return plan.flatMap(({ task, startMs }) => {
    if (!isTaskRecord(task)) return [];
    const duration = typeof task.durationMinutes === 'number' &&
      Number.isFinite(task.durationMinutes) && task.durationMinutes > 0
      ? task.durationMinutes
      : null;
    const nextBoundary = plan.find((entry) => entry.startMs > startMs)?.startMs;
    const endMs = duration === null
      ? Math.max(startMs, nextBoundary ?? dayEndMs)
      : startMs + duration * 60_000;
    const state: PlannedTaskPresentationState = task.completedAt
      ? 'completed'
      : task.startedAt
        ? 'started'
        : nowMs < startMs
          ? 'upcoming'
          : nowMs < endMs
            ? 'planned-now'
            : 'not-started';
    return [{ task, state, startMs, endMs }];
  });
}

export function plannedTaskStateLabel(state: PlannedTaskPresentationState): string {
  switch (state) {
    case 'completed': return 'Выполнено';
    case 'started': return 'Выполняется';
    case 'planned-now': return 'Сейчас по плану';
    case 'not-started': return 'Не начато';
    case 'upcoming': return 'Запланировано';
  }
}
