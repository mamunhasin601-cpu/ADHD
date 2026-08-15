import { BadRequestException } from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';

const series = (rule = 'FREQ=DAILY', zone = 'America/New_York') => ({
  id: 'series-1', userId: 'owner', title: 'Repeat', firstStep: null,
  startTime: new Date('2026-03-07T14:15:00Z'), durationMinutes: 25, color: '#6B5BFC',
  isRecurring: true, recurrenceRule: rule, recurrenceTimezone: zone,
  recurrenceDateKey: '2026-03-07', recurrenceGeneratedThrough: null as string | null,
  parentTaskId: null, completedAt: null, startedAt: null, seriesId: null,
});

function setup(value: any = series()) {
  const rows = new Map<string, any>();
  const task: any = {
    findUnique: jest.fn(({ where }: any) => Promise.resolve(where.id === value.id ? value : rows.get(where.id))),
    createMany: jest.fn(({ data }: any) => {
      let count = 0;
      for (const row of data) {
        const key = `${row.seriesId}:${row.recurrenceDateKey}`;
        if (!rows.has(key)) { rows.set(key, { ...row, completedAt: null, startedAt: null }); count++; }
      }
      return Promise.resolve({ count });
    }),
    update: jest.fn(({ where, data }: any) => { if (where.id === value.id) Object.assign(value, data); return Promise.resolve(value); }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 0 }), delete: jest.fn(),
    findMany: jest.fn(({ where }: any) => {
      if (where?.isRecurring) return Promise.resolve([{ id: value.id, userId: value.userId }]);
      return Promise.resolve([...rows.values()].filter((row) => {
        if (where?.seriesId && row.seriesId !== where.seriesId) return false;
        if (where?.id?.in && !where.id.in.includes(row.id)) return false;
        if (where?.recurrenceDateKey?.gte && row.recurrenceDateKey < where.recurrenceDateKey.gte) return false;
        if (where?.startedAt === null && row.startedAt !== null) return false;
        if (where?.completedAt === null && row.completedAt !== null) return false;
        return true;
      }));
    }),
  };
  const prisma: any = { task, user: { findUnique: jest.fn().mockResolvedValue({ timezone: value.recurrenceTimezone }) } };
  prisma.$transaction = jest.fn((callback: any) => callback(prisma));
  const notifications: any = { scheduleTaskReminder: jest.fn(), cancelTaskReminder: jest.fn() };
  return { service: new TasksService(prisma, notifications, { enforceTaskLimit: jest.fn() } as any), prisma, rows, notifications, value };
}

describe('TasksService recurrence integrity', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-03-07T12:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('preserves wall time across New York spring DST and generates a bounded month rollover', async () => {
    const h = setup(); await h.service.extendSeries('owner', 'series-1');
    const march8 = h.rows.get('series-1:2026-03-08');
    expect(formatInTimeZone(march8.startTime, 'America/New_York', 'yyyy-MM-dd HH:mm')).toBe('2026-03-08 09:15');
    expect(h.rows.has('series-1:2026-04-01')).toBe(true);
    expect(h.rows.size).toBeLessThanOrEqual(61);
  });

  it('preserves New York fall-back and Moscow year rollover while excluding weekends', async () => {
    jest.setSystemTime(new Date('2026-10-31T12:00:00Z'));
    const fall = series('FREQ=DAILY', 'America/New_York'); fall.startTime = new Date('2026-10-31T13:15:00Z'); fall.recurrenceDateKey = '2026-10-31';
    let h = setup(fall); await h.service.extendSeries('owner', fall.id);
    expect(formatInTimeZone(h.rows.get('series-1:2026-11-01').startTime, fall.recurrenceTimezone, 'HH:mm')).toBe('09:15');
    jest.setSystemTime(new Date('2026-12-31T12:00:00Z'));
    const moscow = series('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', 'Europe/Moscow'); moscow.startTime = new Date('2026-12-31T06:15:00Z'); moscow.recurrenceDateKey = '2026-12-31';
    h = setup(moscow); await h.service.extendSeries('owner', moscow.id);
    expect(h.rows.has('series-1:2027-01-01')).toBe(true); expect(h.rows.has('series-1:2027-01-02')).toBe(false);
  });

  it('makes same-boundary extension a true no-op and ignores arbitrary selected dates', async () => {
    const h = setup(); await h.service.extendSeries('owner', 'series-1');
    const writes = h.prisma.task.createMany.mock.calls.length; const schedules = h.notifications.scheduleTaskReminder.mock.calls.length;
    await h.service.extendAllSeries('owner');
    expect(h.prisma.task.createMany).toHaveBeenCalledTimes(writes);
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledTimes(schedules);
  });

  it('uses one transaction and preserves the old projection when it rolls back', async () => {
    const h = setup(); const before = { ...h.value };
    h.prisma.$transaction.mockRejectedValueOnce(new Error('rollback'));
    await expect(h.service.extendSeries('owner', 'series-1')).rejects.toThrow('rollback');
    expect(h.rows.size).toBe(0); expect(h.value).toEqual(before); expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });

  it.each(['Europe/Moscow', 'America/New_York'])('title-only edit in %s preserves anchor, history, and occurrence UUIDs', async (zone) => {
    const value = series('FREQ=DAILY', zone); const h = setup(value);
    const completed = { id: 'past-done', userId: 'owner', seriesId: value.id, recurrenceDateKey: '2026-03-06', startTime: new Date(), completedAt: new Date(), startedAt: null, isRecurring: false };
    const future = { id: 'future-stable', userId: 'owner', seriesId: value.id, recurrenceDateKey: '2026-03-08', startTime: new Date(), completedAt: null, startedAt: null, isRecurring: false };
    h.rows.set(completed.id, completed); h.rows.set(future.id, future);
    h.prisma.task.findUnique.mockImplementation(({ where }: any) => Promise.resolve(where.id === value.id ? value : h.rows.get(where.id)));
    const anchor = value.startTime; const result = await h.service.update('owner', future.id, { title: 'Renamed', startTime: future.startTime.toISOString() });
    expect(value.startTime).toBe(anchor); expect(value.recurrenceTimezone).toBe(zone);
    expect(h.rows.get(completed.id)).toEqual(completed); expect(h.rows.get(future.id)?.id).toBe('future-stable');
    expect(h.prisma.task.deleteMany).not.toHaveBeenCalled();
    expect(result.affectedOccurrenceIds).toEqual([]);
  });

  it('renews autonomously through the server lifecycle', async () => {
    const h = setup(); await expect(h.service.renewRecurrenceHorizons()).resolves.toBeGreaterThan(0);
  });

  it('accepts explicit validated device timezone only when profile timezone is invalid', async () => {
    const h = setup({ ...series(), recurrenceTimezone: null });
    h.prisma.user.findUnique.mockResolvedValue({ timezone: 'invalid' });
    Object.assign(h.value, { recurrenceTimezone: 'Europe/Moscow' });
    h.prisma.task.create = jest.fn().mockResolvedValue(h.value);
    await expect(h.service.create('owner', { title: 'T', startTime: '2026-03-07T06:15:00Z', isRecurring: true, recurrenceRule: 'FREQ=DAILY', deviceTimezone: 'Europe/Moscow' })).resolves.toBeDefined();
    await expect(h.service.create('owner', { title: 'T', startTime: '2026-03-07T06:15:00Z', isRecurring: true, recurrenceRule: 'FREQ=DAILY' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects recurring subtasks and invalid recurrence DTO combinations', async () => {
    const h = setup();
    await expect(h.service.create('owner', { title: 'step', parentTaskId: 'series-1' })).rejects.toBeInstanceOf(BadRequestException);
    const dto = Object.assign(new CreateTaskDto(), { title: 'Invalid', isRecurring: true, recurrenceRule: 'FREQ=DAILY' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('migration preserves supported series and downgrades unsupported rules in place', () => {
    const sql = readFileSync('prisma/migrations/20260815000000_honest_basic_recurrence/migration.sql', 'utf8');
    expect(sql).toContain('"recurrenceTimezone" = u."timezone"');
    expect(sql).toContain('"isRecurring" = false');
    expect(sql).toContain('"recurrenceRule" = NULL');
    expect(sql).toContain("NOT IN\n    ('FREQ=DAILY', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR')");
  });
});
