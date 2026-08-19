import type { Task } from '@focus/shared-types';
import { findCurrentTask } from './current-task';

const task = (id: string, start: string, durationMinutes: number | null): Task => ({
  id, userId: 'u', title: id, startTime: new Date(start), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null,
  startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
});

it('keeps unknown duration current until the next task rather than one hour', () => {
  const unknown = task('unknown', '2026-08-12T09:00:00Z', null);
  const next = task('next', '2026-08-12T12:00:00Z', 30);
  expect(findCurrentTask([unknown, next], new Date('2026-08-12T11:30:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(unknown);
  expect(findCurrentTask([unknown, next], new Date('2026-08-12T12:00:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(next);
});

it('ignores rest and buffer blocks for current work selection', () => {
  const rest = { ...task('rest', '2026-08-12T09:00:00Z', 180), kind: 'REST' as const };
  const work = task('work', '2026-08-12T10:00:00Z', 30);
  expect(findCurrentTask([rest, work], new Date('2026-08-12T09:30:00Z'), new Date('2026-08-13T00:00:00Z'))).toBeNull();
  expect(findCurrentTask([rest, work], new Date('2026-08-12T10:15:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(work);
});
