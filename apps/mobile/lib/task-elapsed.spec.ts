import {
  formatElapsedDuration,
  getTaskElapsedState,
  taskElapsedAccessibilityLabel,
  taskElapsedVisualLabel,
} from './task-elapsed';

const base = { startedAt: new Date('2026-09-27T10:00:00Z'), completedAt: null, durationMinutes: 40 };

it('computes a clamped visual fraction while retaining overtime', () => {
  expect(getTaskElapsedState(base, new Date('2026-09-27T10:20:30Z'))).toMatchObject({
    elapsedMinutes: 20,
    ratio: 0.5,
    progress: 0.5,
    overdue: false,
  });
  const overtime = getTaskElapsedState(base, new Date('2026-09-27T10:50:00Z'))!;
  expect(overtime).toMatchObject({ elapsedMinutes: 50, overrunMinutes: 10, ratio: 1.25, progress: 1, overdue: true });
  expect(taskElapsedAccessibilityLabel(overtime)).toContain('Дольше запланированного');
  expect(taskElapsedAccessibilityLabel(overtime)).toContain('Всего прошло 50 мин');
  expect(taskElapsedAccessibilityLabel(overtime)).toContain('План превышен на 10 мин');
});

it('does not infer progress without an explicit active start and known duration', () => {
  expect(getTaskElapsedState({ ...base, startedAt: null }, new Date())).toBeNull();
  expect(getTaskElapsedState({ ...base, durationMinutes: null }, new Date())).toBeNull();
  expect(getTaskElapsedState({ ...base, completedAt: new Date() }, new Date())).toBeNull();
});

it.each([
  [0, '0 мин'],
  [1, '1 мин'],
  [59, '59 мин'],
  [60, '1 ч'],
  [61, '1 ч 1 мин'],
  [463, '7 ч 43 мин'],
  [24 * 60, '1 д'],
  [14 * 24 * 60 + 2 * 60, '14 д 2 ч'],
])('formats %i elapsed minutes without raw multi-thousand values', (minutes, expected) => {
  expect(formatElapsedDuration(minutes)).toBe(expected);
});

it('labels total elapsed separately from overrun', () => {
  const state = getTaskElapsedState(
    { ...base, durationMinutes: 60 },
    new Date('2026-09-27T17:43:00Z'),
  )!;
  expect(taskElapsedVisualLabel(state)).toBe('Дольше запланированного · прошло 7 ч 43 мин');
  expect(state.overrunMinutes).toBe(403);
  expect(taskElapsedAccessibilityLabel(state)).toContain('План превышен на 6 ч 43 мин');
});

it('uses the explicit absolute startedAt across equivalent timezone offsets', () => {
  const utc = getTaskElapsedState(
    { ...base, startedAt: new Date('2026-09-13T16:25:42.301Z') },
    new Date('2026-09-27T19:45:42.301Z'),
  );
  const offset = getTaskElapsedState(
    { ...base, startedAt: new Date('2026-09-13T19:25:42.301+03:00') },
    new Date('2026-09-27T22:45:42.301+03:00'),
  );
  expect(offset).toEqual(utc);
  expect(utc?.elapsedMinutes).toBe(20_360);
  expect(utc?.progress).toBe(1);
});
