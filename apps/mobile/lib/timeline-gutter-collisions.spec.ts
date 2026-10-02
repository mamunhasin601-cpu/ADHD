import { resolveTimelineGutterCollisions, timelineNowMarkerBounds } from './timeline-gutter-collisions';

it('uses started state, now, task, then tick priority with real bounds', () => {
  const result = resolveTimelineGutterCollisions([
    { id: 'tick', kind: 'tick', top: 98, height: 20 },
    { id: 'task', kind: 'task', top: 100, height: 24 },
    { id: 'now', kind: 'now', top: 104, height: 25 },
    { id: 'started', kind: 'started', top: 103, height: 25 },
    { id: 'far', kind: 'tick', top: 180, height: 20 },
  ]);
  expect(Array.from(result.visibleIds)).toEqual(expect.arrayContaining(['started', 'far']));
  expect(Array.from(result.hiddenIds)).toEqual(expect.arrayContaining(['now', 'task', 'tick']));
});

it('includes the complete marker circle around current-time boundaries', () => {
  expect(timelineNowMarkerBounds(100, 25)).toEqual({ top: 86.5, height: 27 });
  expect(timelineNowMarkerBounds(100, 10, 21)).toEqual({ top: 88.5, height: 23 });
  const marker = timelineNowMarkerBounds(100, 25);
  const result = resolveTimelineGutterCollisions([
    { id: 'now', kind: 'now', ...marker },
    { id: 'task', kind: 'task', top: 112, height: 24 },
  ]);
  expect(result.visibleIds.has('now')).toBe(true);
  expect(result.hiddenIds.has('task')).toBe(true);
});

it('keeps close-in-time labels when their rendered rectangles do not intersect', () => {
  const result = resolveTimelineGutterCollisions([
    { id: 'now', kind: 'now', top: 100, height: 20 },
    { id: 'task', kind: 'task', top: 123, height: 20 },
  ]);
  expect(result.visibleIds.has('now')).toBe(true);
  expect(result.visibleIds.has('task')).toBe(true);
});
