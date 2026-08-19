import { TasksService } from './tasks.service';

const REQUEST_ID = '00000000-0000-4000-8000-000000000027';

function setup(initial: any[] = []) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
  const claims = new Map<string, any>();
  let sequence = 1;

  const materialize = (row: any, include?: any) => row && ({
    ...row,
    ...(include?.subTasks ? { subTasks: [] } : {}),
  });
  const task = {
    create: jest.fn(async ({ data, include }: any) => {
      const id = `block-${sequence++}`;
      const row = {
        id,
        ...data,
        kind: data.kind ?? 'TASK',
        parentTaskId: data.parentTaskId ?? null,
        completedAt: null,
        startedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.set(id, row);
      return materialize(row, include);
    }),
    findUnique: jest.fn(async ({ where, include }: any) => materialize(rows.get(where.id), include)),
    findMany: jest.fn(async () => []),
    update: jest.fn(async ({ where, data, include }: any) => {
      const row = { ...rows.get(where.id), ...data, updatedAt: new Date() };
      rows.set(where.id, row);
      return materialize(row, include);
    }),
    count: jest.fn(async () => 0),
  };
  const taskCreateRequest = {
    create: jest.fn(async ({ data }: any) => {
      const key = `${data.userId}:${data.requestId}`;
      if (claims.has(key)) throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
      const claim = { ...data, taskId: null };
      claims.set(key, claim);
      return claim;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const key = `${where.userId_requestId.userId}:${where.userId_requestId.requestId}`;
      const claim = { ...claims.get(key), ...data };
      claims.set(key, claim);
      return claim;
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      const key = `${where.userId_requestId.userId}:${where.userId_requestId.requestId}`;
      return claims.get(key) ?? null;
    }),
  };
  const prisma: any = {
    task,
    taskCreateRequest,
    user: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
  };
  prisma.$transaction = jest.fn((callback: any) => callback(prisma));
  const notifications = {
    scheduleTaskReminder: jest.fn(),
    cancelTaskReminder: jest.fn(),
  };
  const plan = { enforceTaskLimit: jest.fn() };

  return {
    service: new TasksService(prisma, notifications as any, plan as any),
    prisma,
    notifications,
    plan,
    rows,
  };
}

const block = (kind: 'REST' | 'BUFFER', overrides: Record<string, unknown> = {}) => ({
  createRequestId: REQUEST_ID,
  title: kind === 'REST' ? 'Pause' : 'Transition',
  kind,
  startTime: '2026-08-19T10:00:00.000Z',
  durationMinutes: 30,
  ...overrides,
});

describe('TasksService task kinds', () => {
  it.each(['REST', 'BUFFER'] as const)('creates %s idempotently without quota or reminder scheduling', async (kind) => {
    const h = setup();
    const first = await h.service.create('owner', block(kind));
    const retry = await h.service.create('owner', block(kind));

    expect(retry.id).toBe(first.id);
    expect(first).toMatchObject({ kind, startTime: new Date('2026-08-19T10:00:00.000Z'), durationMinutes: 30 });
    expect(h.rows.size).toBe(1);
    expect(h.plan.enforceTaskLimit).not.toHaveBeenCalled();
    expect(h.notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith(first.id);
  });

  it('includes kind in the idempotency identity', async () => {
    const h = setup();
    await h.service.create('owner', block('REST'));

    await expect(h.service.create('owner', block('BUFFER'))).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'TASK_CREATE_REQUEST_CONFLICT' }),
    });
    expect(h.rows.size).toBe(1);
  });

  it.each([
    ['missing time', { startTime: undefined }],
    ['unknown duration', { durationMinutes: null }],
    ['recurrence', { isRecurring: true, recurrenceRule: 'FREQ=DAILY' }],
    ['parts field', { subTasks: [] }],
    ['first step', { firstStep: 'Open notes' }],
    ['parent', { parentTaskId: 'parent' }],
  ])('rejects %s before claiming idempotency', async (_label, invalid) => {
    const h = setup();
    await expect(h.service.create('owner', block('REST', invalid))).rejects.toMatchObject({ status: 400 });
    expect(h.prisma.taskCreateRequest.create).not.toHaveBeenCalled();
    expect(h.prisma.task.create).not.toHaveBeenCalled();
    expect(h.plan.enforceTaskLimit).not.toHaveBeenCalled();
  });

  it('defaults an omitted kind to TASK for legacy callers', async () => {
    const h = setup();
    const created = await h.service.create('owner', { title: 'Legacy task' });
    expect(created.kind).toBe('TASK');
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledWith('owner');
  });

  it('returns blocks for a date but restricts inbox, incomplete, and reminder ranges to TASK', async () => {
    const h = setup();
    await h.service.findAll('owner', { date: '2026-08-19', deviceTimezone: 'UTC' });
    expect(h.prisma.task.findMany.mock.calls[0][0].where).not.toHaveProperty('kind');

    await h.service.findAll('owner', { inbox: true });
    expect(h.prisma.task.findMany.mock.calls[1][0].where).toMatchObject({ kind: 'TASK', startTime: null });

    await h.service.findAll('owner', { incomplete: true });
    expect(h.prisma.task.findMany.mock.calls[2][0].where).toMatchObject({ kind: 'TASK', completedAt: null });

    await h.service.findAll('owner', {
      scheduledFrom: '2026-08-19T00:00:00.000Z',
      scheduledTo: '2026-08-20T00:00:00.000Z',
    });
    expect(h.prisma.task.findMany.mock.calls[3][0].where).toMatchObject({ kind: 'TASK' });
  });

  it('allows REST to BUFFER edits but rejects TASK conversions and task lifecycle commands', async () => {
    const rest = {
      id: 'rest', userId: 'owner', title: 'Pause', kind: 'REST',
      startTime: new Date('2026-08-19T10:00:00.000Z'), durationMinutes: 30,
      parentTaskId: null, completedAt: null, startedAt: null, isRecurring: false,
      recurrenceRule: null, seriesId: null, firstStep: null,
    };
    const h = setup([rest]);
    await expect(h.service.update('owner', rest.id, { kind: 'BUFFER', durationMinutes: 45 }))
      .resolves.toMatchObject({ kind: 'BUFFER', durationMinutes: 45 });
    expect(h.notifications.cancelTaskReminder).toHaveBeenCalledWith(rest.id);

    await expect(h.service.update('owner', rest.id, { kind: 'TASK' })).rejects.toMatchObject({ status: 400 });
    await expect(h.service.start('owner', rest.id)).rejects.toMatchObject({ status: 400 });
    await expect(h.service.toggleComplete('owner', rest.id)).rejects.toMatchObject({ status: 400 });
    await expect(h.service.extendSeries('owner', rest.id)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects TASK to block conversion without mutating the task', async () => {
    const task = {
      id: 'task', userId: 'owner', title: 'Task', kind: 'TASK', startTime: null,
      durationMinutes: null, parentTaskId: null, completedAt: null, startedAt: null,
      isRecurring: false, recurrenceRule: null, seriesId: null, firstStep: null,
    };
    const h = setup([task]);
    await expect(h.service.update('owner', task.id, { kind: 'REST' })).rejects.toMatchObject({ status: 400 });
    expect(h.prisma.task.update).not.toHaveBeenCalled();
  });
});
