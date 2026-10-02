import { formatTaskActionSchedule, isFutureUnstartedTask } from './task-action-confirmation';

describe('task action confirmation', () => {
  const nowMs = new Date('2026-09-28T17:56:00.000Z').getTime();

  it('requires confirmation only for future incomplete unstarted tasks', () => {
    const future = { startTime: new Date('2026-09-28T23:15:00.000Z'), startedAt: null, completedAt: null };
    expect(isFutureUnstartedTask(future, nowMs)).toBe(true);
    expect(isFutureUnstartedTask({ ...future, startedAt: new Date() }, nowMs)).toBe(false);
    expect(isFutureUnstartedTask({ ...future, completedAt: new Date() }, nowMs)).toBe(false);
    expect(isFutureUnstartedTask({ ...future, startTime: new Date('2026-09-28T17:55:00.000Z') }, nowMs)).toBe(false);
  });

  it('formats same-day H24 and H12 schedule labels', () => {
    const planned = '2026-09-28T23:15:00.000Z';
    expect(formatTaskActionSchedule(planned, nowMs, 'H24', 'UTC')).toBe('23:15');
    expect(formatTaskActionSchedule(planned, nowMs, 'H12', 'UTC')).toMatch(/11:15\s*PM/i);
  });

  it('includes the localized date on another profile-local day', () => {
    expect(formatTaskActionSchedule(
      '2026-09-29T23:15:00.000Z',
      nowMs,
      'H24',
      'UTC',
    )).toMatch(/29 сентября, 23:15/);
  });

  it('uses the profile-local date boundary instead of UTC', () => {
    expect(formatTaskActionSchedule(
      '2026-09-29T00:15:00.000Z',
      new Date('2026-09-28T23:30:00.000Z').getTime(),
      'H24',
      'Europe/Moscow',
    )).toBe('03:15');
  });
});
