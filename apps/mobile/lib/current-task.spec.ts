import type { Task } from '@focus/shared-types';
import { findCurrentTask } from './current-task';

const task = (id: string, start: string, durationMinutes: number | null): Task => ({
  id, userId: 'u', title: id, startTime: new Date(start), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null,
  startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
});

it('keeps unknown duration current until the next ordinary task rather than one hour', () => {
  const unknown = task('unknown', '2026-08-12T09:00:00Z', null);
  const next = task('next', '2026-08-12T12:00:00Z', 30);
  expect(findCurrentTask([unknown, next], new Date('2026-08-12T11:30:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(unknown);
  expect(findCurrentTask([unknown, next], new Date('2026-08-12T12:00:00Z'), new Date('2026-08-13T00:00:00Z'))).toBe(next);
});

it.each(['REST', 'BUFFER'] as const)(
  'uses a %s start as the exact boundary for an unknown-duration task without returning the block',
  (kind) => {
    const unknown = task('unknown', '2026-08-12T09:00:00Z', null);
    const block = { ...task('block', '2026-08-12T10:00:00Z', 30), kind };
    const next = task('next', '2026-08-12T12:00:00Z', 30);
    const plan = [unknown, block, next];
    const dayEnd = new Date('2026-08-13T00:00:00Z');

    expect(findCurrentTask(plan, new Date('2026-08-12T09:30:00Z'), dayEnd)).toBe(unknown);
    expect(findCurrentTask(plan, new Date('2026-08-12T10:00:00Z'), dayEnd)).toBeNull();
    expect(findCurrentTask(plan, new Date('2026-08-12T11:59:59Z'), dayEnd)).toBeNull();
    expect(findCurrentTask(plan, new Date('2026-08-12T12:00:00Z'), dayEnd)).toBe(next);
  },
);

it('does not truncate a known positive task duration at an overlapping block boundary', () => {
  const known = task('known', '2026-08-12T09:00:00Z', 120);
  const rest = { ...task('rest', '2026-08-12T10:00:00Z', 30), kind: 'REST' as const };
  expect(findCurrentTask(
    [known, rest],
    new Date('2026-08-12T10:30:00Z'),
    new Date('2026-08-13T00:00:00Z'),
  )).toBe(known);
});
