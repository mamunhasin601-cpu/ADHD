import type { Task } from '@focus/shared-types';
import { computeTimelineLayout, UNKNOWN_DURATION_LAYOUT_MINUTES } from './timeline-layout';

const task = (id: string, start: string, durationMinutes: number | null): Task => ({
  id, userId: 'u', title: id, startTime: new Date(start), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, createdAt: new Date(), updatedAt: new Date(),
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
