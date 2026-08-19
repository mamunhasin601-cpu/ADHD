import type { Task, TaskKind } from '@focus/shared-types';

export function normalizeTaskKind(value: unknown): TaskKind {
  return value === 'REST' || value === 'BUFFER' ? value : 'TASK';
}

export function taskKind(task: Pick<Task, 'kind'>): TaskKind {
  return normalizeTaskKind(task.kind);
}

export function isTaskRecord(task: Pick<Task, 'kind'>): boolean {
  return taskKind(task) === 'TASK';
}
