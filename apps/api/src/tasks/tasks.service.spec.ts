import { TasksService } from './tasks.service';

describe('TasksService — синхронизация напоминаний', () => {
  let service: TasksService;
  let prisma: any;
  let notifications: any;
  let planService: any;

  const userId = 'user-1';

  beforeEach(() => {
    prisma = {
      task: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
    };
    notifications = {
      scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
      cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
    };
    planService = {
      enforceTaskLimit: jest.fn().mockResolvedValue(undefined),
    };
    service = new TasksService(prisma, notifications, planService);
  });

  it('create(): планирует напоминание, если задан startTime', async () => {
    const task = { id: 't1', userId, startTime: new Date(Date.now() + 60_000), completedAt: null };
    prisma.task.create.mockResolvedValue(task);

    await service.create(userId, {
      title: 'Тест',
      startTime: task.startTime.toISOString(),
    } as any);

    expect(notifications.scheduleTaskReminder).toHaveBeenCalledWith(task);
    expect(notifications.cancelTaskReminder).not.toHaveBeenCalled();
  });

  it.each([
    ['omitted', undefined, null],
    ['explicit null', null, null],
    ['numeric', 45, 45],
  ])('create(): preserves %s duration as %p', async (_label, duration, expected) => {
    const task = { id: 'duration-create', userId, startTime: null, completedAt: null };
    prisma.task.create.mockResolvedValue(task);
    await service.create(userId, {
      title: 'Duration',
      ...(duration !== undefined ? { durationMinutes: duration } : {}),
    });
    expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durationMinutes: expected }),
    }));
  });

  it.each([
    ['omitted', undefined, false],
    ['explicit null', null, null],
    ['numeric', 90, 90],
  ])('update(): handles %s duration without inventing a value', async (_label, duration, expected) => {
    const existing = { id: 'duration-update', userId, startTime: null, completedAt: null };
    prisma.task.findUnique.mockResolvedValue(existing);
    prisma.task.update.mockResolvedValue(existing);
    await service.update(userId, existing.id, {
      ...(duration !== undefined ? { durationMinutes: duration } : {}),
    });
    const data = prisma.task.update.mock.calls[0][0].data;
    if (expected === false) expect(data).not.toHaveProperty('durationMinutes');
    else expect(data.durationMinutes).toBe(expected);
  });

  it('create(): не планирует напоминание, если startTime не задан (просто снимает возможный старый job)', async () => {
    const task = { id: 't2', userId, startTime: null, completedAt: null };
    prisma.task.create.mockResolvedValue(task);

    await service.create(userId, { title: 'Тест без времени' } as any);

    expect(notifications.cancelTaskReminder).toHaveBeenCalledWith('t2');
    expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('toggleComplete(): при отметке "выполнено" отменяет напоминание', async () => {
    const existing = { id: 't3', userId, startTime: new Date(Date.now() + 60_000), completedAt: null };
    const updated = { ...existing, completedAt: new Date() };
    prisma.task.findUnique.mockResolvedValue(existing);
    prisma.task.update.mockResolvedValue(updated);

    await service.toggleComplete(userId, 't3');

    expect(notifications.cancelTaskReminder).toHaveBeenCalledWith('t3');
    expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });

  it('remove(): отменяет напоминание после удаления задачи', async () => {
    const existing = { id: 't4', userId, startTime: new Date(Date.now() + 60_000), completedAt: null };
    prisma.task.findUnique.mockResolvedValue(existing);
    prisma.task.delete.mockResolvedValue(undefined);

    await service.remove(userId, 't4');

    expect(notifications.cancelTaskReminder).toHaveBeenCalledWith('t4');
  });

  it('ошибка в notifications не должна ронять CRUD-операцию', async () => {
    const task = { id: 't5', userId, startTime: new Date(Date.now() + 60_000), completedAt: null };
    prisma.task.create.mockResolvedValue(task);
    notifications.scheduleTaskReminder.mockRejectedValue(new Error('Redis недоступен'));

    const result = await service.create(userId, { title: 'Тест' } as any);
    expect(result).toEqual(task); // create не бросило исключение, задача уже сохранена в БД
  });

  it('start(): atomically preserves the first server timestamp and cancels its reminder', async () => {
    const original = { id: 'started', userId, startTime: new Date('2026-08-14T10:00:00Z'), durationMinutes: 45, isRecurring: true, recurrenceRule: 'FREQ=DAILY', completedAt: null, startedAt: null };
    let stored = original;
    prisma.task.findUnique.mockImplementation(() => Promise.resolve(stored));
    prisma.task.updateMany.mockImplementation(({ where, data }: any) => {
      if (stored.startedAt === where.startedAt && stored.completedAt === null) stored = { ...stored, ...data };
      return Promise.resolve({ count: 1 });
    });

    const first = await service.start(userId, original.id);
    const second = await service.start(userId, original.id);

    expect(first.startedAt).toBeInstanceOf(Date);
    expect(second.startedAt).toBe(first.startedAt);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: original.id, userId, startedAt: null, completedAt: null },
    }));
    expect(second).toMatchObject({ startTime: original.startTime, durationMinutes: 45, recurrenceRule: 'FREQ=DAILY', completedAt: null });
    expect(notifications.cancelTaskReminder).toHaveBeenCalledWith(original.id);
  });

  it('start(): rejects a completed task without writing', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'done', userId, completedAt: new Date(), startedAt: null });
    await expect(service.start(userId, 'done')).rejects.toMatchObject({ status: 409 });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('update(): never reschedules a reminder for a previously started task', async () => {
    const started = { id: 's', userId, startTime: new Date(), completedAt: null, startedAt: new Date() };
    prisma.task.findUnique.mockResolvedValue(started);
    prisma.task.update.mockResolvedValue(started);
    await service.update(userId, started.id, { title: 'Edited' });
    expect(notifications.cancelTaskReminder).toHaveBeenCalledWith(started.id);
    expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inbox фильтр — findAll с inbox=true
// ─────────────────────────────────────────────────────────────────────────────

describe('TasksService.findAll — inbox filter', () => {
  let service: TasksService;
  let prisma: any;
  let notifications: any;
  let planService: any;

  const userId = 'user-inbox-1';

  const inboxTask = {
    id: 'task-inbox-1',
    userId,
    title: 'Задача без времени',
    startTime: null,
    completedAt: null,
    isRecurring: false,
    parentTaskId: null,
  };

  const scheduledTask = {
    id: 'task-scheduled-1',
    userId,
    title: 'Запланированная задача',
    startTime: new Date('2026-08-04T10:00:00.000Z'),
    completedAt: null,
    isRecurring: false,
    parentTaskId: null,
  };

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }),
      },
    };
    notifications = {
      scheduleTaskReminder: jest.fn(),
      cancelTaskReminder: jest.fn(),
    };
    planService = { enforceTaskLimit: jest.fn() };
    service = new TasksService(prisma, notifications, planService);
  });

  it('inbox=true передаёт startTime: null в where', async () => {
    prisma.task.findMany.mockResolvedValue([inboxTask]);

    await service.findAll(userId, { inbox: true });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.startTime).toBeNull();
    expect(whereArg.userId).toBe(userId);
    expect(whereArg.parentTaskId).toBeNull(); // только root tasks
  });

  it('inbox=true игнорирует параметр date', async () => {
    prisma.task.findMany.mockResolvedValue([inboxTask]);

    await service.findAll(userId, { inbox: true, date: '2026-08-04' });

    // При inbox=true where.startTime === null, а не объект с gte/lte
    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.startTime).toBeNull();
    // Получение user.findUnique для timezone не должно вызываться (inbox не использует дату)
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('inbox=true возвращает только задачи с startTime=null', async () => {
    prisma.task.findMany.mockResolvedValue([inboxTask]);

    const result = await service.findAll(userId, { inbox: true });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task-inbox-1');
  });

  it('inbox=true возвращает пустой массив если Inbox пуст', async () => {
    prisma.task.findMany.mockResolvedValue([]);

    const result = await service.findAll(userId, { inbox: true });

    expect(result).toHaveLength(0);
  });

  it('inbox=true не возвращает scheduled задачи', async () => {
    // Prisma в реальности отфильтрует по where; в unit-тесте мокаем возврат
    prisma.task.findMany.mockResolvedValue([inboxTask]); // только inbox

    const result = await service.findAll(userId, { inbox: true });

    const hasScheduled = result.some((t: any) => t.startTime !== null);
    expect(hasScheduled).toBe(false);
  });

  it('inbox=false + date → применяет date-range фильтр (существующее поведение не сломано)', async () => {
    prisma.task.findMany.mockResolvedValue([scheduledTask]);

    await service.findAll(userId, { date: '2026-08-04' });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.startTime).toHaveProperty('gte');
    expect(whereArg.startTime).toHaveProperty('lte');
    // Timezone должна быть запрошена
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('returns a task scheduled at the profile wall-clock time for that profile day', async () => {
    const profileDayTask = {
      ...scheduledTask,
      id: 'task-profile-day',
      startTime: new Date('2026-08-11T11:00:00.000Z'),
    };
    const outsideProfileDayTask = {
      ...scheduledTask,
      id: 'task-outside-profile-day',
      startTime: new Date('2026-08-11T21:00:00.000Z'),
    };
    prisma.task.findMany.mockImplementation(({ where }: any) =>
      [profileDayTask, outsideProfileDayTask].filter(
        (task) =>
          task.startTime >= where.startTime.gte && task.startTime <= where.startTime.lte,
      ),
    );

    const result = await service.findAll(userId, { date: '2026-08-11' });

    expect(prisma.task.findMany.mock.calls[0][0].where.startTime).toEqual({
      gte: new Date('2026-08-10T21:00:00.000Z'),
      lte: new Date('2026-08-11T20:59:59.999Z'),
    });
    expect(result).toEqual([profileDayTask]);
  });

  it('scheduledFrom + scheduledTo → applies exact startTime range to Prisma (bounded bootstrap)', async () => {
    prisma.task.findMany.mockResolvedValue([scheduledTask]);

    const from = '2026-08-05T00:00:00.000Z';
    const to = '2026-08-12T23:59:59.999Z';
    await service.findAll(userId, { scheduledFrom: from, scheduledTo: to });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.startTime).toMatchObject({
      gte: new Date(from),
      lte: new Date(to),
    });
    // Timezone lookup not needed for range queries
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('scheduledFrom only → uses 30-day server horizon as upper bound', async () => {
    prisma.task.findMany.mockResolvedValue([]);

    const from = '2026-08-05T00:00:00.000Z';
    await service.findAll(userId, { scheduledFrom: from });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    const expectedMax = new Date(new Date(from).getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(whereArg.startTime.gte).toEqual(new Date(from));
    // Upper bound must not exceed 30 days
    expect(whereArg.startTime.lte).toEqual(expectedMax);
  });

  it('scheduledTo exceeding 30 days is capped at 30-day server horizon', async () => {
    prisma.task.findMany.mockResolvedValue([]);

    const from = '2026-08-05T00:00:00.000Z';
    const farFuture = '2030-01-01T00:00:00.000Z'; // way beyond 30 days
    await service.findAll(userId, { scheduledFrom: from, scheduledTo: farFuture });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    const maxAllowed = new Date(new Date(from).getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(whereArg.startTime.lte).toEqual(maxAllowed);
    expect(whereArg.startTime.lte < new Date(farFuture)).toBe(true);
  });

  it('inbox=true ignores scheduledFrom/scheduledTo (inbox not date-bound)', async () => {
    prisma.task.findMany.mockResolvedValue([inboxTask]);

    await service.findAll(userId, {
      inbox: true,
      scheduledFrom: '2026-08-05T00:00:00.000Z',
      scheduledTo: '2026-08-12T23:59:59.999Z',
    });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.startTime).toBeNull();
  });

  it('inbox=true не принимает caller-supplied userId — только из сервисного параметра', async () => {
    prisma.task.findMany.mockResolvedValue([inboxTask]);

    await service.findAll(userId, { inbox: true });

    const whereArg = prisma.task.findMany.mock.calls[0][0].where;
    // userId в where должен быть тем же, что передан сервису
    expect(whereArg.userId).toBe(userId);
  });
});
