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
        const duplicate = [...rows.values()].some((existing) =>
          existing.seriesId === row.seriesId && existing.recurrenceDateKey === row.recurrenceDateKey,
        );
        if (!duplicate) { rows.set(key, { ...row, completedAt: null, startedAt: null }); count++; }
      }
      return Promise.resolve({ count });
    }),
    create: jest.fn(({ data }: any) => {
      const created = { ...data, completedAt: null, startedAt: null, subTasks: [] };
      rows.set(created.id, created);
      return Promise.resolve(created);
    }),
    update: jest.fn(({ where, data }: any) => {
      const target = where.id === value.id ? value : rows.get(where.id);
      Object.assign(target, data);
      return Promise.resolve({ ...target, subTasks: target.subTasks ?? [] });
    }),
    updateMany: jest.fn(({ where, data }: any) => {
      let count = 0;
      for (const row of [value, ...rows.values()]) {
        if (where?.id?.in && !where.id.in.includes(row.id)) continue;
        if (where?.seriesId?.in && !where.seriesId.in.includes(row.seriesId)) continue;
        if (typeof where?.seriesId === 'string' && row.seriesId !== where.seriesId) continue;
        if (where?.recurrenceDateKey?.gte && row.recurrenceDateKey < where.recurrenceDateKey.gte) continue;
        if (where?.startedAt === null && row.startedAt !== null) continue;
        if (where?.completedAt === null && row.completedAt !== null) continue;
        Object.assign(row, data);
        count += 1;
      }
      return Promise.resolve({ count });
    }),
    deleteMany: jest.fn(({ where }: any) => {
      let count = 0;
      for (const [key, row] of rows) {
        if (where?.id?.in && !where.id.in.includes(row.id)) continue;
        if (where?.seriesId?.in && !where.seriesId.in.includes(row.seriesId)) continue;
        if (typeof where?.seriesId === 'string' && row.seriesId !== where.seriesId) continue;
        if (where?.recurrenceDateKey?.gte && row.recurrenceDateKey < where.recurrenceDateKey.gte) continue;
        if (where?.startedAt === null && row.startedAt !== null) continue;
        if (where?.completedAt === null && row.completedAt !== null) continue;
        rows.delete(key);
        count += 1;
      }
      return Promise.resolve({ count });
    }),
    delete: jest.fn(),
    findMany: jest.fn(({ where }: any) => {
      const source = where?.isRecurring === true ? [value, ...rows.values()] : [...rows.values()];
      return Promise.resolve(source.filter((row) => {
        if (where?.userId && row.userId !== where.userId) return false;
        if (where?.seriesId === null && row.seriesId != null) return false;
        if (where?.seriesId?.in && !where.seriesId.in.includes(row.seriesId)) return false;
        if (typeof where?.seriesId === 'string' && row.seriesId !== where.seriesId) return false;
        if (where?.recurrenceRootId && row.recurrenceRootId !== where.recurrenceRootId) return false;
        if (where?.id?.in && !where.id.in.includes(row.id)) return false;
        if (where?.id?.notIn && where.id.notIn.includes(row.id)) return false;
        if (where?.isRecurring !== undefined && row.isRecurring !== where.isRecurring) return false;
        if (where?.parentTaskId === null && row.parentTaskId != null) return false;
        if (where?.startTime?.gte && row.startTime < where.startTime.gte) return false;
        if (where?.startTime?.lt && row.startTime >= where.startTime.lt) return false;
        if (where?.recurrenceDateKey?.gte && row.recurrenceDateKey < where.recurrenceDateKey.gte) return false;
        if (where?.startedAt === null && row.startedAt !== null) return false;
        if (where?.completedAt === null && row.completedAt !== null) return false;
        return true;
      }));
    }),
  };
  const prisma: any = {
    task,
    user: { findUnique: jest.fn().mockResolvedValue({ timezone: value.recurrenceTimezone }) },
    recoveryUndoItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
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

  it('edits only the selected occurrence without regenerating the series', async () => {
    const h = setup();
    const selected = {
      id: 'selected', userId: 'owner', seriesId: h.value.id, recurrenceDateKey: '2026-03-08',
      title: 'Repeat', firstStep: null, startTime: new Date('2026-03-08T13:15:00Z'),
      durationMinutes: 25, color: '#6B5BFC', completedAt: null, startedAt: null, isRecurring: false,
    };
    const future = { ...selected, id: 'future', recurrenceDateKey: '2026-03-09', startTime: new Date('2026-03-09T13:15:00Z') };
    h.rows.set(selected.id, selected);
    h.rows.set(future.id, future);

    const result = await h.service.update('owner', selected.id, {
      title: 'One changed event',
      recurrenceEditScope: 'ONLY_THIS',
    });

    expect(h.rows.get(selected.id).title).toBe('One changed event');
    expect(h.rows.get(future.id).title).toBe('Repeat');
    expect(h.value.title).toBe('Repeat');
    expect(h.prisma.task.deleteMany).not.toHaveBeenCalled();
    expect(result.affectedOccurrenceIds).toEqual([selected.id]);
  });

  it('edits the entire series from its anchor when explicitly selected', async () => {
    const h = setup();
    const first = {
      id: 'first', userId: 'owner', seriesId: h.value.id, recurrenceDateKey: '2026-03-07',
      title: 'Repeat', startTime: new Date('2026-03-07T14:15:00Z'), durationMinutes: 15,
      completedAt: null, startedAt: null, isRecurring: false,
    };
    const selected = { ...first, id: 'selected', recurrenceDateKey: '2026-03-08', startTime: new Date('2026-03-08T13:15:00Z') };
    h.rows.set(first.id, first);
    h.rows.set(selected.id, selected);

    await h.service.update('owner', selected.id, {
      durationMinutes: 60,
      recurrenceEditScope: 'ENTIRE_SERIES',
    });

    expect(h.rows.get(first.id).durationMinutes).toBe(60);
    expect(h.rows.get(selected.id).durationMinutes).toBe(60);
  });

  it('splits this-and-future at the selected local date and preserves completed history', async () => {
    const h = setup();
    const past = {
      id: 'past', userId: 'owner', seriesId: h.value.id, recurrenceDateKey: '2026-03-07',
      title: 'Repeat', startTime: new Date('2026-03-07T14:15:00Z'), durationMinutes: 25,
      completedAt: new Date('2026-03-07T15:00:00Z'), startedAt: null, isRecurring: false,
    };
    const selected = {
      ...past, id: 'selected', recurrenceDateKey: '2026-03-08',
      startTime: new Date('2026-03-08T13:15:00Z'), completedAt: null, firstStep: null, color: '#6B5BFC',
    };
    const future = { ...selected, id: 'future', recurrenceDateKey: '2026-03-09', startTime: new Date('2026-03-09T13:15:00Z') };
    const protectedFuture = {
      ...selected,
      id: 'future-completed',
      recurrenceDateKey: '2026-03-10',
      startTime: new Date('2026-03-10T13:15:00Z'),
      completedAt: new Date('2026-03-07T16:00:00Z'),
    };
    h.rows.set(past.id, past);
    h.rows.set(selected.id, selected);
    h.rows.set(future.id, future);
    h.rows.set(protectedFuture.id, protectedFuture);

    const result = await h.service.update('owner', selected.id, {
      title: 'New branch',
      recurrenceEditScope: 'THIS_AND_FUTURE',
      startTime: '2026-03-08T14:15:00Z',
      editRecurrenceAnchor: true,
      isRecurring: true,
      recurrenceRule: 'FREQ=DAILY',
    });

    expect(h.rows.get(past.id)).toEqual(past);
    expect(h.value.recurrenceGeneratedThrough).toBe('2026-03-07');
    expect(h.value.recurrenceEndedAt).toBeInstanceOf(Date);
    expect(result.id).not.toBe(h.value.id);
    expect(result.recurrenceRootId).toBe(h.value.id);
    expect(result.title).toBe('New branch');
    expect(result.affectedOccurrenceIds).toEqual(expect.arrayContaining(['selected', 'future']));
    expect(h.rows.get(protectedFuture.id)).toMatchObject({
      id: protectedFuture.id,
      completedAt: protectedFuture.completedAt,
      seriesId: result.id,
    });
    const generated = [...h.rows.values()].filter((row) => row.seriesId === result.id);
    expect(generated.filter((row) => row.recurrenceDateKey === '2026-03-08')).toHaveLength(1);
    expect(generated.filter((row) => row.recurrenceDateKey === '2026-03-10')).toHaveLength(1);
    const splitOccurrence = generated.find((row) => row.recurrenceDateKey === '2026-03-08');
    expect(formatInTimeZone(splitOccurrence.startTime, 'America/New_York', 'HH:mm')).toBe('10:15');
    expect(h.prisma.recoveryUndoItem.deleteMany).toHaveBeenCalledWith({
      where: { taskId: { in: expect.arrayContaining(['selected', 'future']) } },
    });
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith('selected');
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith('future');
  });

  it('renews autonomously through the server lifecycle', async () => {
    const h = setup(); await expect(h.service.renewRecurrenceHorizons()).resolves.toBeGreaterThan(0);
  });

  it('keeps whole-series deletion behavior for an occurrence', async () => {
    const h = setup();
    const occurrence = {
      id: 'occurrence', userId: 'owner', seriesId: h.value.id, recurrenceDateKey: '2026-03-08',
      title: 'Repeat', startTime: new Date('2026-03-08T13:15:00Z'), durationMinutes: 25,
      completedAt: null, startedAt: null, isRecurring: false,
    };
    h.rows.set(occurrence.id, occurrence);

    await expect(h.service.remove('owner', occurrence.id)).resolves.toEqual({
      affectedOccurrenceIds: [occurrence.id],
    });
    expect(h.prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [h.value.id] } } });
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith(occurrence.id);
  });

  it('updates and deletes the whole logical lineage after multiple technical splits', async () => {
    const root = { ...series(), recurrenceRootId: 'logical-root', recurrenceEndedAt: new Date('2026-03-08T00:00:00Z') };
    const h = setup(root);
    const middle = {
      ...series(), id: 'series-2', recurrenceRootId: 'logical-root', recurrenceDateKey: '2026-03-09',
      recurrenceEndedAt: new Date('2026-03-11T00:00:00Z'), createdAt: new Date('2026-03-08T00:00:00Z'),
    };
    const late = {
      ...series(), id: 'series-3', recurrenceRootId: 'logical-root', recurrenceDateKey: '2026-03-12',
      recurrenceEndedAt: null, createdAt: new Date('2026-03-11T00:00:00Z'),
    };
    const earlyOccurrence = {
      id: 'early', userId: 'owner', seriesId: root.id, recurrenceRootId: 'logical-root',
      recurrenceDateKey: '2026-03-07', title: 'Repeat', startTime: new Date('2026-03-07T14:15:00Z'),
      durationMinutes: 25, completedAt: null, startedAt: null, isRecurring: false,
    };
    const protectedOccurrence = {
      ...earlyOccurrence, id: 'protected', seriesId: middle.id, recurrenceDateKey: '2026-03-10',
      startedAt: new Date('2026-03-10T14:15:00Z'),
    };
    const selected = {
      ...earlyOccurrence, id: 'late-occurrence', seriesId: late.id, recurrenceDateKey: '2026-03-12',
    };
    for (const row of [middle, late, earlyOccurrence, protectedOccurrence, selected]) h.rows.set(row.id, row);

    await h.service.update('owner', selected.id, {
      title: 'Whole lineage',
      recurrenceEditScope: 'ENTIRE_SERIES',
    });

    expect(root.title).toBe('Whole lineage');
    expect(h.rows.get(middle.id).title).toBe('Whole lineage');
    expect(h.rows.get(late.id).title).toBe('Whole lineage');
    expect(h.rows.get(earlyOccurrence.id).title).toBe('Whole lineage');
    expect(h.rows.get(selected.id).title).toBe('Whole lineage');
    expect(h.rows.get(protectedOccurrence.id).title).toBe('Repeat');

    await expect(h.service.remove('owner', selected.id)).resolves.toEqual({
      affectedOccurrenceIds: expect.arrayContaining(['early', 'protected', 'late-occurrence']),
    });
    expect(h.prisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['series-1', 'series-2', 'series-3'] } },
    });
    expect(h.prisma.recoveryUndoItem.deleteMany).toHaveBeenCalledWith({
      where: { taskId: { in: expect.arrayContaining(['early', 'protected', 'late-occurrence']) } },
    });
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

  it('lineage migration backfills templates, split chains, and occurrences without touching overlap migration', () => {
    const sql = readFileSync('prisma/migrations/20260927000000_add_recurrence_root_lineage/migration.sql', 'utf8');
    expect(sql).toContain('ADD COLUMN "recurrenceRootId"');
    expect(sql).toContain('WITH RECURSIVE');
    expect(sql).toContain('candidate_edges');
    expect(sql).toContain('occurrence."seriesId" = template."id"');
    expect(sql).toContain('tasks_userId_recurrenceRootId_idx');
  });
});
