import type { Task } from '@focus/shared-types';
import { computeTimelineConflictGroups, computeTimelineLayout, UNKNOWN_DURATION_LAYOUT_MINUTES } from './timeline-layout';

const task = (id: string, start: string, durationMinutes: number | null): Task => ({
  id, userId: 'u', title: id, startTime: new Date(start), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null,
  startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
});

it('marks one deterministic label owner for every connected legacy conflict group', () => {
  const first = task('first', '2026-08-13T18:30:00.000Z', 30);
  const second = task('second', '2026-08-13T18:45:00.000Z', 30);
  const third = task('third', '2026-08-13T19:00:00.000Z', 15);
  const separate = task('separate', '2026-08-13T21:00:00.000Z', 15);
  expect(computeTimelineConflictGroups([separate, third, second, first], 'America/New_York')).toEqual([
    {
      id: 'conflict:first:second:third',
      taskIds: ['first', 'second', 'third'],
      labelTaskId: 'first',
    },
  ]);
});

it('uses a documented visual-only interval for unknown duration without mutation', () => {
  const unknown = task('unknown', '2026-08-12T10:00:00Z', null);
  const overlapping = task(
    'overlap',
    new Date(new Date(unknown.startTime!).getTime() + (UNKNOWN_DURATION_LAYOUT_MINUTES / 2) * 60000).toISOString(),
    15,
  );
  const layout = computeTimelineLayout([unknown, overlapping]);
  expect(layout.get('unknown')?.columnCount).toBe(2);
  expect(unknown.durationMinutes).toBeNull();
});

it('keeps overlap columns deterministic in profile-local coordinates', () => {
  const first = task('first', '2026-08-13T18:30:00.000Z', 30);
  const second = task('second', '2026-08-13T18:45:00.000Z', 30);
  const third = task('third', '2026-08-13T19:00:00.000Z', 15);
  const layout = computeTimelineLayout([third, second, first], 'America/New_York');
  expect(Array.from(layout.entries())).toEqual([
    ['first', { columnIndex: 0, columnCount: 2 }],
    ['second', { columnIndex: 1, columnCount: 2 }],
    ['third', { columnIndex: 0, columnCount: 2 }],
  ]);
});

it('excludes recurrence series templates from conflict groups even with an anchor date key', () => {
  const first = task('first', '2026-08-13T18:30:00.000Z', 30);
  const template = {
    ...task('template', '2026-08-13T18:35:00.000Z', 30),
    isRecurring: true,
    recurrenceDateKey: '2026-08-13',
  };
  expect(computeTimelineConflictGroups([first, template], 'America/New_York')).toEqual([]);
});
