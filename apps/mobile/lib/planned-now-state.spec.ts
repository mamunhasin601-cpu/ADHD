import type { Task } from '@focus/shared-types';
import { derivePlannedTaskStates } from './planned-now-state';

const task = (id: string, start: string, durationMinutes: number | null, patch: Partial<Task> = {}): Task => ({
  id, userId: 'u', title: id, startTime: new Date(start), durationMinutes,
  color: '#6B5BFC', isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
  ...patch,
});

const states = (tasks: Task[], now: string) => derivePlannedTaskStates(
  tasks,
  new Date(now).getTime(),
  new Date('2026-09-29T00:00:00.000Z').getTime(),
);

it('uses inclusive start and exclusive end boundaries without starting the task', () => {
  const scheduled = task('scheduled', '2026-09-28T10:00:00.000Z', 30);
  expect(states([scheduled], '2026-09-28T09:59:59.999Z')[0].state).toBe('upcoming');
  expect(states([scheduled], '2026-09-28T10:00:00.000Z')[0].state).toBe('planned-now');
  expect(states([scheduled], '2026-09-28T10:29:59.999Z')[0].state).toBe('planned-now');
  expect(states([scheduled], '2026-09-28T10:30:00.000Z')[0].state).toBe('not-started');
  expect(scheduled.startedAt).toBeNull();
});

it('keeps completed and explicitly started lifecycle states authoritative', () => {
  const completed = task('done', '2026-09-28T10:00:00.000Z', 30, { completedAt: new Date() });
  const started = task('active', '2026-09-28T12:00:00.000Z', 30, { startedAt: new Date() });
  expect(states([completed, started], '2026-09-28T11:00:00.000Z').map(({ state }) => state)).toEqual([
    'completed',
    'started',
  ]);
});

it.each([
  ['before schedule', '2026-09-28T09:45:00.000Z', '2026-09-28T09:50:00.000Z'],
  ['inside interval', '2026-09-28T10:10:00.000Z', '2026-09-28T10:15:00.000Z'],
  ['after interval', '2026-09-28T10:45:00.000Z', '2026-09-28T11:00:00.000Z'],
])('keeps explicit Start authoritative when it happened %s', (_case, startedAt, now) => {
  const started = task('started', '2026-09-28T10:00:00.000Z', 30, { startedAt: new Date(startedAt) });
  expect(states([started], now)[0].state).toBe('started');
});

it('supports overlapping planned-now tasks while preserving one explicit active task', () => {
  const active = task('active', '2026-09-28T09:00:00.000Z', 180, { startedAt: new Date() });
  const first = task('first', '2026-09-28T10:00:00.000Z', 60);
  const second = task('second', '2026-09-28T10:15:00.000Z', 30);
  const result = states([active, first, second], '2026-09-28T10:20:00.000Z');
  expect(result.filter(({ state }) => state === 'started').map(({ task }) => task.id)).toEqual(['active']);
  expect(result.filter(({ state }) => state === 'planned-now').map(({ task }) => task.id)).toEqual(['first', 'second']);
});

it('uses the next plan boundary for unknown and non-positive durations', () => {
  const unknown = task('unknown', '2026-09-28T09:00:00.000Z', null);
  const zero = task('zero', '2026-09-28T11:00:00.000Z', 0);
  const rest = task('rest', '2026-09-28T10:00:00.000Z', 30, { kind: 'REST' });
  expect(states([unknown, rest, zero], '2026-09-28T09:59:59.999Z').find(({ task }) => task.id === 'unknown')?.state).toBe('planned-now');
  expect(states([unknown, rest, zero], '2026-09-28T10:00:00.000Z').find(({ task }) => task.id === 'unknown')?.state).toBe('not-started');
  expect(states([zero], '2026-09-28T23:59:59.999Z')[0].state).toBe('planned-now');
});

it('excludes technical recurrence templates from planned-now presentation', () => {
  const unknown = task('unknown', '2026-09-28T09:00:00.000Z', null);
  const template = task('template', '2026-09-28T10:00:00.000Z', 30, {
    isRecurring: true,
    recurrenceDateKey: '2026-09-28',
  });
  const occurrence = task('occurrence', '2026-09-28T11:00:00.000Z', 30, {
    isRecurring: false,
    seriesId: 'template',
    recurrenceDateKey: '2026-09-28',
  });
  const result = states([unknown, template, occurrence], '2026-09-28T10:05:00.000Z');
  expect(result.map(({ task }) => task.id)).toEqual(['unknown', 'occurrence']);
  expect(result[0].state).toBe('planned-now');
});

it('uses the supplied profile-day boundary for an unknown-duration final task', () => {
  const final = task('final', '2026-09-28T13:30:00.000Z', null);
  const aucklandDayEnd = new Date('2026-09-28T14:00:00.000Z').getTime();
  expect(derivePlannedTaskStates([final], new Date('2026-09-28T13:59:59.999Z').getTime(), aucklandDayEnd)[0].state)
    .toBe('planned-now');
  expect(derivePlannedTaskStates([final], aucklandDayEnd, aucklandDayEnd)[0].state)
    .toBe('not-started');
});

it('treats invalid and negative durations as unknown without mutating canonical fields', () => {
  const invalid = task('invalid', '2026-09-28T10:00:00.000Z', Number.NaN);
  const negative = task('negative', '2026-09-28T11:00:00.000Z', -15);
  const before = [invalid, negative].map((entry) => ({
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    durationMinutes: entry.durationMinutes,
  }));

  const result = states([invalid, negative], '2026-09-28T10:30:00.000Z');

  expect(result.map(({ state }) => state)).toEqual(['planned-now', 'upcoming']);
  expect([invalid, negative].map((entry) => ({
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    durationMinutes: entry.durationMinutes,
  }))).toEqual(before);
});
