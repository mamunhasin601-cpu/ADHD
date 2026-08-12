import type { Task } from '@focus/shared-types';
import { findCurrentTask } from './current-task';

const task = (id: string, start: string, durationMinutes: number | null): Task => ({
  id, userId: 'u', title: id, startTime: new Date(start), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, createdAt: new Date(), updatedAt: new Date(),
});

it('keeps unknown duration current until the next task rather than one hour', () => {
  const unknown = task('unknown', '2026-08-12T09:00:00Z', null);
  const next = task('next', '2026-08-12T12:00:00Z', 30);
  expect(findCurrentTask([unknown, next], new Date('2026-08-12T11:30:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(unknown);
  expect(findCurrentTask([unknown, next], new Date('2026-08-12T12:00:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(next);
});
