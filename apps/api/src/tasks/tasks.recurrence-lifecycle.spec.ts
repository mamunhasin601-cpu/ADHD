import { TasksService } from './tasks.service';

const base = (overrides: any = {}) => ({ id: 'task', userId: 'owner', title: 'Task', firstStep: null,
  startTime: new Date('2026-08-15T06:00:00Z'), durationMinutes: 25, color: '#6B5BFC', isRecurring: false,
  recurrenceRule: null, recurrenceTimezone: null, recurrenceDateKey: null, recurrenceGeneratedThrough: null,
  recurrenceEndedAt: null, seriesId: null, parentTaskId: null, startedAt: null, completedAt: null, ...overrides });

function harness(initial: any, occurrences: any[] = []) {
  let template = structuredClone(initial); let rows = structuredClone(occurrences);
  const task: any = {
    findUnique: jest.fn(({ where }: any) => Promise.resolve(where.id === template.id ? template : rows.find((x) => x.id === where.id))),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(({ where, data }: any) => { if (where.id === template.id) template = { ...template, ...data }; return Promise.resolve(template); }),
    findMany: jest.fn(({ where, select }: any) => Promise.resolve(rows.filter((x) => {
      if (where?.seriesId && x.seriesId !== where.seriesId) return false;
      if (where?.recurrenceDateKey?.gt && x.recurrenceDateKey <= where.recurrenceDateKey.gt) return false;
      if (where?.recurrenceDateKey?.gte && x.recurrenceDateKey < where.recurrenceDateKey.gte) return false;
      if (where?.startedAt === null && x.startedAt !== null) return false;
      if (where?.completedAt === null && x.completedAt !== null) return false;
      if (where?.id?.in && !where.id.in.includes(x.id)) return false;
      return true;
    }).map((x) => select?.id ? { id: x.id } : x))),
    deleteMany: jest.fn(({ where }: any) => { const before = rows.length; rows = rows.filter((x) => !(x.seriesId === where.seriesId &&
      (!where.recurrenceDateKey?.gt || x.recurrenceDateKey > where.recurrenceDateKey.gt) &&
      (!where.recurrenceDateKey?.gte || x.recurrenceDateKey >= where.recurrenceDateKey.gte) && x.startedAt === null && x.completedAt === null));
      return Promise.resolve({ count: before - rows.length }); }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn(({ data }: any) => { rows.push(...data.map((x: any) => ({ ...x, startedAt: null, completedAt: null }))); return Promise.resolve({ count: data.length }); }),
  };
  const prisma: any = { task, user: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) } };
  prisma.$transaction = jest.fn(async (callback: any) => {
    const oldTemplate = structuredClone(template); const oldRows = structuredClone(rows);
    try { return await callback(prisma); } catch (error) { template = oldTemplate; rows = oldRows; throw error; }
  });
  const notifications: any = { cancelTaskReminder: jest.fn(), scheduleTaskReminder: jest.fn() };
  const service = new TasksService(prisma, notifications, { enforceTaskLimit: jest.fn() } as any);
  return { service, prisma, notifications, template: () => template, rows: () => rows };
}

describe('recurrence lifecycle state machine', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('atomically converts a safe timed root task into a series and never reminds the template', async () => {
    const h = harness(base());
    const result = await h.service.update('owner', 'task', { isRecurring: true, recurrenceRule: 'FREQ=DAILY', deviceTimezone: 'Europe/Moscow' });
    expect(h.template()).toMatchObject({ isRecurring: true, recurrenceTimezone: 'Europe/Moscow', recurrenceDateKey: '2026-08-15', recurrenceGeneratedThrough: '2026-10-14' });
    expect(result.newOccurrenceIds?.length).toBeGreaterThan(0);
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith('task');
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'task' }));
  });

  it('rejects unsafe conversion of started tasks or tasks with subtasks', async () => {
    const started = harness(base({ startedAt: new Date() }));
    await expect(started.service.update('owner', 'task', { isRecurring: true, recurrenceRule: 'FREQ=DAILY' })).rejects.toMatchObject({ status: 400 });
    const withSteps = harness(base()); withSteps.prisma.task.count.mockResolvedValue(1);
    await expect(withSteps.service.update('owner', 'task', { isRecurring: true, recurrenceRule: 'FREQ=DAILY' })).rejects.toMatchObject({ status: 400 });
  });

  it('stops after today while retaining today, past, started, and completed identities', async () => {
    const active = base({ isRecurring: true, recurrenceRule: 'FREQ=DAILY', recurrenceTimezone: 'Europe/Moscow', recurrenceDateKey: '2026-08-01', recurrenceGeneratedThrough: '2026-10-14' });
    const rows = [
      base({ id: 'past', seriesId: 'task', isRecurring: false, recurrenceDateKey: '2026-08-14' }),
      base({ id: 'today', seriesId: 'task', isRecurring: false, recurrenceDateKey: '2026-08-15' }),
      base({ id: 'future', seriesId: 'task', isRecurring: false, recurrenceDateKey: '2026-08-16' }),
      base({ id: 'started', seriesId: 'task', isRecurring: false, recurrenceDateKey: '2026-08-17', startedAt: new Date() }),
      base({ id: 'done', seriesId: 'task', isRecurring: false, recurrenceDateKey: '2026-08-18', completedAt: new Date() }),
    ];
    const h = harness(active, rows); const result = await h.service.update('owner', 'today', { isRecurring: false, recurrenceRule: null, editRecurrencePattern: true });
    expect(h.template().recurrenceEndedAt).toBeInstanceOf(Date);
    expect(h.rows().map((x) => x.id)).toEqual(['past', 'today', 'started', 'done']);
    expect(result.affectedOccurrenceIds).toEqual(['future']);
  });

  it('rolls back metadata, deletion, insertion, and generated-through when insertion fails inside the transaction', async () => {
    const active = base({ isRecurring: true, recurrenceRule: 'FREQ=DAILY', recurrenceTimezone: 'Europe/Moscow', recurrenceDateKey: '2026-08-01', recurrenceGeneratedThrough: '2026-10-14' });
    const future = base({ id: 'future', seriesId: 'task', isRecurring: false, recurrenceDateKey: '2026-08-16' });
    const h = harness(active, [future]); h.prisma.task.createMany.mockRejectedValue(new Error('insert failed'));
    await expect(h.service.update('owner', 'future', { startTime: '2026-08-01T07:00:00Z', editRecurrenceAnchor: true })).rejects.toThrow('insert failed');
    expect(h.template()).toMatchObject({ startTime: new Date('2026-08-15T06:00:00Z'), recurrenceGeneratedThrough: '2026-10-14' });
    expect(h.rows()).toEqual([future]);
  });
});

describe('recurrence scheduler batching', () => {
  it('uses bounded deterministic pages and isolates one failing series', async () => {
    const task: any = { findMany: jest.fn()
      .mockResolvedValueOnce([{ id: 'a', userId: 'u1' }, { id: 'b', userId: 'u2' }])
      .mockResolvedValueOnce([{ id: 'c', userId: 'u3' }]) };
    const service = new TasksService({ task } as any, {} as any, {} as any);
    jest.spyOn(service, 'extendSeries').mockRejectedValueOnce(new Error('bad')).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    await expect(service.renewRecurrenceHorizons(2)).resolves.toBe(5);
    expect(task.findMany.mock.calls[0][0]).toMatchObject({ orderBy: { id: 'asc' }, take: 2 });
    expect(task.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 'b' }, skip: 1 });
  });
});
