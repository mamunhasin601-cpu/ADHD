import { normalizeProgress } from './ProgressRing';

describe('progress normalization', () => {
  it.each([
    [0, 0, 0, 0, 0],
    [1, 4, 1, 4, 25],
    [4, 4, 4, 4, 100],
    [-2, 3, 0, 3, 0],
    [9, 3, 3, 3, 100],
    [Number.NaN, Number.POSITIVE_INFINITY, 0, 0, 0],
  ])(
    'clamps completed=%p and total=%p',
    (completed, total, safeCompleted, safeTotal, percent) => {
      expect(normalizeProgress(completed, total)).toEqual({
        completed: safeCompleted,
        total: safeTotal,
        percent,
      });
    },
  );
});
