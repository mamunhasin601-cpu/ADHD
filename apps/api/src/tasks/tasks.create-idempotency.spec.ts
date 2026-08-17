import { TasksService } from './tasks.service';

const REQUEST_ID = '00000000-0000-4000-8000-000000000025';

function setup() {
  const rows = new Map<string, any>();
  const claims = new Map<string, any>();
  let sequence = 1;
  let transactionQueue = Promise.resolve();

  const materialize = (row: any, include?: any) => row && ({
    ...row,
    ...(include?.subTasks ? {
      subTasks: [...rows.values()].filter((part) => part.parentTaskId === row.id).map((part) => ({ ...part })),
    } : {}),
  });
  const task = {
    create: jest.fn(async ({ data, include }: any) => {
      const id = `00000000-0000-4000-8001-${String(sequence++).padStart(12, '0')}`;
      const row = {
        id,
        ...data,
        parentTaskId: data.parentTaskId ?? null,
        completedAt: data.completedAt ?? null,
        startedAt: data.startedAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.set(id, row);
      return materialize(row, include);
    }),
    findUnique: jest.fn(async ({ where, include }: any) => materialize(rows.get(where.id), include)),
    findMany: jest.fn(async () => []),
  };
  const taskCreateRequest = {
    create: jest.fn(async ({ data }: any) => {
      const key = `${data.userId}:${data.requestId}`;
      if (claims.has(key)) throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
      claims.set(key, { ...data, taskId: null });
      return claims.get(key);
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
  const prisma: any = { task, taskCreateRequest, user: { findUnique: jest.fn() } };
  prisma.$transaction = jest.fn(async (callback: any) => {
    const previous = transactionQueue;
    let release!: () => void;
    transactionQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback(prisma);
    } finally {
      release();
    }
  });
  const notifications = {
    scheduleTaskReminder: jest.fn(),
    cancelTaskReminder: jest.fn(),
  };
  const plan = { enforceTaskLimit: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new TasksService(prisma, notifications as any, plan as any),
    prisma,
    notifications,
    plan,
    rows: () => [...rows.values()],
  };
}

const dto = () => ({
  createRequestId: REQUEST_ID,
  title: 'Parent',
  startTime: '2026-08-18T10:00:00.000Z',
  subTasks: [{ title: 'One' }, { title: 'Two', completed: true }],
});

describe('TasksService root create idempotency', () => {
  it('returns the canonical parent and exact part UUIDs on an identical committed retry', async () => {
    const h = setup();
    const first: any = await h.service.create('owner', dto());
    const retry: any = await h.service.create('owner', dto());

    expect(retry.id).toBe(first.id);
    expect(retry.subTasks.map((part: any) => part.id)).toEqual(first.subTasks.map((part: any) => part.id));
    expect(h.rows()).toHaveLength(3);
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledTimes(1);
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledWith('owner', h.prisma);
  });

  it('serializes concurrent identical requests into one canonical creation', async () => {
    const h = setup();
    const [first, second]: any[] = await Promise.all([
      h.service.create('owner', dto()),
      h.service.create('owner', dto()),
    ]);

    expect(second.id).toBe(first.id);
    expect(second.subTasks.map((part: any) => part.id)).toEqual(first.subTasks.map((part: any) => part.id));
    expect(h.rows()).toHaveLength(3);
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledTimes(1);
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
  });

  it('returns a deterministic conflict when one identity is reused for another payload', async () => {
    const h = setup();
    await h.service.create('owner', dto());

    await expect(h.service.create('owner', { ...dto(), title: 'Different' }))
      .rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'TASK_CREATE_REQUEST_CONFLICT' }),
      });
    expect(h.rows()).toHaveLength(3);
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledTimes(1);
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
  });

  it('scopes the same request identity independently to each authenticated owner', async () => {
    const h = setup();
    const first = await h.service.create('owner-a', dto());
    const second = await h.service.create('owner-b', dto());

    expect(second.id).not.toBe(first.id);
    expect(h.rows().filter((row) => row.parentTaskId === null)).toHaveLength(2);
    expect(h.plan.enforceTaskLimit).toHaveBeenCalledTimes(2);
    expect(h.notifications.scheduleTaskReminder).toHaveBeenCalledTimes(2);
  });
});
