import {
  clampTaskProgress,
  diagonalProgressPath,
  diagonalProgressThreshold,
  shouldAnimateTaskProgress,
} from './task-progress-fill';

it('clamps diagonal endpoints to empty and completely filled', () => {
  expect(clampTaskProgress(-1)).toBe(0);
  expect(clampTaskProgress(2)).toBe(1);
  expect(diagonalProgressPath(0)).toBe('');
  expect(diagonalProgressPath(1)).toBe('M 0 0 L 100 0 L 100 100 L 0 100 Z');
});

it('maps progress linearly by filled area on both halves of the diagonal sweep', () => {
  expect(diagonalProgressThreshold(0.125)).toBeCloseTo(0.5);
  expect(diagonalProgressThreshold(0.5)).toBeCloseTo(1);
  expect(diagonalProgressThreshold(0.875)).toBeCloseTo(1.5);
  expect(diagonalProgressPath(0.25, 100, 100)).toMatch(/^M 0 0 L/);
  expect(diagonalProgressPath(0.75, 100, 100)).toContain('L 100 0');
});

it('adds a finite two-bend edge only while the settling wave has amplitude', () => {
  expect(diagonalProgressPath(0.5, 100, 100, 3)).toContain('Q');
  expect(diagonalProgressPath(0.5, 100, 100, 0)).not.toContain('Q');
});

it('animates only an active foreground advance without Reduce Motion', () => {
  const base = {
    previousProgress: 0.2,
    nextProgress: 0.3,
    previousStartedAt: '2026-09-27T10:00:00Z',
    nextStartedAt: '2026-09-27T10:00:00Z',
    animationEnabled: true,
    appIsActive: true,
    reduceMotion: false,
  };
  expect(shouldAnimateTaskProgress(base)).toBe(true);
  expect(shouldAnimateTaskProgress({ ...base, nextProgress: 0.2 })).toBe(false);
  expect(shouldAnimateTaskProgress({ ...base, animationEnabled: false })).toBe(false);
  expect(shouldAnimateTaskProgress({ ...base, appIsActive: false })).toBe(false);
  expect(shouldAnimateTaskProgress({ ...base, reduceMotion: true })).toBe(false);
  expect(shouldAnimateTaskProgress({
    ...base,
    previousProgress: 0,
    nextProgress: 0,
    previousStartedAt: null,
  })).toBe(true);
});
