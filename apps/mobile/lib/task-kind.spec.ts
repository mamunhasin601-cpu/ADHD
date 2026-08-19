import type { Task } from '@focus/shared-types';
import { isTaskRecord, normalizeTaskKind, taskKind } from './task-kind';

it('treats missing and invalid legacy kinds as TASK', () => {
  expect(normalizeTaskKind(undefined)).toBe('TASK');
  expect(normalizeTaskKind('EVENT')).toBe('TASK');
  expect(taskKind({} as Pick<Task, 'kind'>)).toBe('TASK');
  expect(isTaskRecord({} as Pick<Task, 'kind'>)).toBe(true);
});

it.each(['REST', 'BUFFER'] as const)('recognizes %s as a non-task block', (kind) => {
  expect(normalizeTaskKind(kind)).toBe(kind);
  expect(isTaskRecord({ kind })).toBe(false);
});
