import { TasksService } from './tasks.service';

const started = new Date('2026-09-28T16:18:10.000Z');
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId: 'owner',
  title: `Task ${id}`,
  kind: 'TASK',
  startTime: new Date('2026-01-01T16:00:00.000Z'),
  durationMinutes: 30,
  color: '#6B5BFC',
  isRecurring: false,
  recurrenceRule: null,
  recurrenceTimezone: null,
  recurrenceDateKey: null,
  recurrenceGeneratedThrough: null,
  recurrenceEndedAt: null,
  recurrenceRootId: null,
  seriesId: null,
  parentTaskId: null,
  completedAt: null,
  startedAt: null,
  firstStep: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function setup(initial: any[]) {
  let rows = new Map(initial.map((task) => [task.id, { ...task }]));
  let transactionTail = Promise.resolve();
  let failAfterLostFocus = false;
  const task = {
    findUnique: jest.fn(async ({ where, include }: any) => {
      const value = rows.get(where.id);
      return value ? { ...value, ...(include?.subTasks ? { subTasks: [] } : {}) } : null;
    }),
    findMany: jest.fn(async ({ where }: any) => [...rows.values()]
      .filter((value: any) => value.userId === where.userId && value.startedAt && !value.completedAt)
      .sort((a: any, b: any) => b.startedAt.getTime() - a.startedAt.getTime() || a.id.localeCompare(b.id))
      .map((value) => ({ ...value }))),
    updateMany: jest.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const [id, value] of rows) {
        if (where.id && typeof where.id === 'string' && id !== where.id) continue;
        if (where.id?.not && id === where.id.not) continue;
        if (where.userId && value.userId !== where.userId) continue;
        if (where.startedAt === null && value.startedAt !== null) continue;
        if (where.startedAt?.not === null && value.startedAt === null) continue;
        if (where.completedAt === null && value.completedAt !== null) continue;
        rows.set(id, { ...value, ...data });
        count += 1;
      }
      if (failAfterLostFocus && data.startedAt === null) {
        failAfterLostFocus = false;
        throw new Error('transaction failed');
      }
      return { count };
    }),
  };
  const prisma: any = { task };
  prisma.$transaction = jest.fn((callback: any) => {
    const run = transactionTail.then(async () => {
      const snapshot = new Map([...rows].map(([id, value]) => [id, { ...value }]));
      try {
        return await callback(prisma);
      } catch (error) {
        rows = snapshot;
        throw error;
      }
    });
    transactionTail = run.then(() => undefined, () => undefined);
    return run;
  });
  const notifications = { cancelTaskReminder: jest.fn().mockResolvedValue(undefined) };
  const service = new TasksService(prisma, notifications as any, {} as any);
  return { service, prisma, notifications, rows: () => rows, failNextSwitch: () => { failAfterLostFocus = true; } };
}

describe('TasksService one-active start lifecycle', () => {
  afterEach(() => jest.useRealTimers());

  it('starts with the actual server instant and is idempotent for the same target', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T16:20:03.456Z'));
    const h = setup([row('target')]);
    const first = await h.service.start('owner', 'target');
    const second = await h.service.start('owner', 'target');
    expect(first.startedAt).toEqual(new Date('2026-09-28T16:20:03.456Z'));
    expect(second.startedAt).toEqual(first.startedAt);
    expect(h.prisma.task.updateMany).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit confirmation before an early start and preserves the plan', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T16:20:03.456Z'));
    const planned = new Date('2026-09-28T23:15:00.000Z');
    const h = setup([row('future', { title: 'Поздняя задача', startTime: planned })]);

    await expect(h.service.start('owner', 'future')).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'EARLY_START_CONFIRMATION_REQUIRED',
        scheduledTask: { id: 'future', title: 'Поздняя задача', startTime: planned },
      },
    });
    expect(h.rows().get('future')).toMatchObject({ startTime: planned, startedAt: null, completedAt: null });

    const startedTask = await h.service.start('owner', 'future', false, true);
    expect(startedTask).toMatchObject({
      startTime: planned,
      startedAt: new Date('2026-09-28T16:20:03.456Z'),
      completedAt: null,
    });
  });

  it('returns an already-started future task without asking for early-start confirmation again', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T16:20:03.456Z'));
    const originalStartedAt = new Date('2026-09-28T16:00:00.000Z');
    const h = setup([row('future', {
      startTime: new Date('2026-09-28T23:15:00.000Z'),
      startedAt: originalStartedAt,
    })]);

    await expect(h.service.start('owner', 'future')).resolves.toMatchObject({
      id: 'future',
      startedAt: originalStartedAt,
      completedAt: null,
    });
    expect(h.prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('requires early-start then active-switch confirmation without an intermediate mutation', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T16:20:03.456Z'));
    const previousStart = new Date('2026-09-28T15:00:00.000Z');
    const h = setup([
      row('active', { startedAt: previousStart }),
      row('future', { startTime: new Date('2026-09-28T23:15:00.000Z') }),
    ]);

    await expect(h.service.start('owner', 'future')).rejects.toMatchObject({
      response: { code: 'EARLY_START_CONFIRMATION_REQUIRED' },
    });
    await expect(h.service.start('owner', 'future', false, true)).rejects.toMatchObject({
      response: { code: 'ACTIVE_TASK_CONFLICT', activeTask: { id: 'active' } },
    });
    expect(h.rows().get('active')).toMatchObject({ startedAt: previousStart, completedAt: null });
    expect(h.rows().get('future')).toMatchObject({ startedAt: null, completedAt: null });

    const result = await h.service.start('owner', 'future', true, true);
    expect(h.rows().get('active')).toMatchObject({ startedAt: null, completedAt: null });
    expect(result).toMatchObject({
      id: 'future',
      startedAt: new Date('2026-09-28T16:20:03.456Z'),
      completedAt: null,
    });
  });

  it('returns a typed conflict with only the active task summary', async () => {
    const h = setup([row('active', { title: 'Длинная текущая задача', startedAt: started }), row('target')]);
    await expect(h.service.start('owner', 'target')).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'ACTIVE_TASK_CONFLICT',
        activeTask: { id: 'active', title: 'Длинная текущая задача', startedAt: started },
      },
    });
    expect(h.rows().get('target')!.startedAt).toBeNull();
  });

  it('atomically moves every legacy active task to lost focus and starts the target without completion', async () => {
    const occurrence = row('target', { seriesId: 'series', recurrenceRootId: 'root', recurrenceDateKey: '2026-09-28' });
    const h = setup([row('old-a', { startedAt: started }), row('old-b', { startedAt: new Date(started.getTime() + 1) }), occurrence]);
    const result = await h.service.start('owner', 'target', true);
    expect(h.rows().get('old-a')).toMatchObject({ startedAt: null, completedAt: null });
    expect(h.rows().get('old-b')).toMatchObject({ startedAt: null, completedAt: null });
    expect(result).toMatchObject({ id: 'target', startedAt: expect.any(Date), seriesId: 'series', recurrenceRootId: 'root', recurrenceDateKey: '2026-09-28' });
    expect([...h.rows().values()].filter((task: any) => task.userId === 'owner' && task.startedAt && !task.completedAt)).toHaveLength(1);
  });

  it('rolls back lost-focus writes when target start fails inside the transaction', async () => {
    const h = setup([row('active', { startedAt: started }), row('target')]);
    h.failNextSwitch();
    await expect(h.service.start('owner', 'target', true)).rejects.toThrow('transaction failed');
    expect(h.rows().get('active')!.startedAt).toEqual(started);
    expect(h.rows().get('target')!.startedAt).toBeNull();
  });

  it('serializes concurrent starts and isolates another user', async () => {
    const h = setup([row('a'), row('b'), row('foreign', { userId: 'other', startedAt: started })]);
    const results = await Promise.allSettled([
      h.service.start('owner', 'a'),
      h.service.start('owner', 'b'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect([...h.rows().values()].filter((task: any) => task.userId === 'owner' && task.startedAt)).toHaveLength(1);
    expect(h.rows().get('foreign')!.startedAt).toEqual(started);
  });
});
