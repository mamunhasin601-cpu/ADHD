import { TasksService } from './tasks.service';

const userId = 'owner';
const baseTask = () => ({
  id: 'task-1', userId, title: 'Task', startTime: new Date('2026-08-14T10:00:00Z'),
  durationMinutes: 45, isRecurring: false, recurrenceRule: 'FREQ=DAILY', seriesId: 'series-1',
  completedAt: null as Date | null, startedAt: null as Date | null,
});

function setup() {
  const prisma: any = { task: {
    findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn(),
    create: jest.fn(), delete: jest.fn(), findMany: jest.fn(),
  } };
  const notifications: any = {
    cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
    scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
  };
  const service = new TasksService(prisma, notifications, { enforceTaskLimit: jest.fn() } as any);
  return { service, prisma, notifications };
}

describe('TasksService.start', () => {
  it('returns 404 for a missing task and preserves ownership denial for another user', async () => {
    const { service, prisma } = setup();
    prisma.task.findUnique.mockResolvedValueOnce(null);
    await expect(service.start(userId, 'missing')).rejects.toMatchObject({ status: 404 });
    prisma.task.findUnique.mockResolvedValueOnce({ ...baseTask(), userId: 'other' });
    await expect(service.start(userId, 'foreign')).rejects.toMatchObject({ status: 403 });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('rejects completed tasks with 409 without a write', async () => {
    const { service, prisma } = setup();
    prisma.task.findUnique.mockResolvedValue({ ...baseTask(), completedAt: new Date() });
    await expect(service.start(userId, 'task-1')).rejects.toMatchObject({ status: 409 });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('keeps a repeated start idempotent and preserves all scheduling fields and other tasks', async () => {
    const { service, prisma, notifications } = setup(); let stored: any = baseTask();
    const other = { ...baseTask(), id: 'task-2' };
    prisma.task.findUnique.mockImplementation(({ where }: any) => Promise.resolve(where.id === stored.id ? stored : other));
    prisma.task.updateMany.mockImplementation(({ where, data }: any) => {
      if (stored.id === where.id && stored.userId === where.userId && stored.startedAt === null && stored.completedAt === null) {
        stored = { ...stored, ...data }; return Promise.resolve({ count: 1 });
      }
      return Promise.resolve({ count: 0 });
    });
    const first = await service.start(userId, stored.id); const second = await service.start(userId, stored.id);
    expect(second.startedAt).toBe(first.startedAt);
    expect(second).toMatchObject({ startTime: new Date('2026-08-14T10:00:00Z'), durationMinutes: 45, isRecurring: false, recurrenceRule: 'FREQ=DAILY', completedAt: null });
    expect(other.startedAt).toBeNull();
    expect(prisma.task.updateMany).toHaveBeenCalledWith({ where: { id: 'task-1', userId, startedAt: null, completedAt: null }, data: { startedAt: expect.any(Date) } });
    expect(notifications.cancelTaskReminder).toHaveBeenCalledWith('task-1');
  });

  it('deterministically lets only one concurrent conditional write win', async () => {
    const { service, prisma } = setup(); let stored: any = baseTask(); let initialReads = 0; let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    prisma.task.findUnique.mockImplementation(async () => {
      if (initialReads < 2) { initialReads += 1; await barrier; return { ...stored, startedAt: null }; }
      return stored;
    });
    let winners = 0;
    prisma.task.updateMany.mockImplementation(({ where, data }: any) => {
      if (stored.startedAt === null) { stored = { ...stored, ...data }; winners += 1; return Promise.resolve({ count: 1 }); }
      return Promise.resolve({ count: 0 });
    });
    const firstPromise = service.start(userId, 'task-1'); const secondPromise = service.start(userId, 'task-1');
    expect(initialReads).toBe(2); expect(prisma.task.updateMany).not.toHaveBeenCalled(); release();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(winners).toBe(1); expect(first.startedAt).toBe(second.startedAt);
    expect(prisma.task.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'task-1', userId, startedAt: null, completedAt: null } }));
  });

  it('returns 409 with no start when completion wins before the conditional write', async () => {
    const { service, prisma } = setup(); let stored: any = baseTask();
    prisma.task.findUnique.mockImplementation(() => Promise.resolve(stored));
    prisma.task.updateMany.mockImplementation(() => { stored = { ...stored, completedAt: new Date(), startedAt: null }; return Promise.resolve({ count: 0 }); });
    await expect(service.start(userId, 'task-1')).rejects.toMatchObject({ status: 409 });
    expect(stored.startedAt).toBeNull();
  });

  it('preserves the first timestamp when start wins before completion', async () => {
    const { service, prisma } = setup(); let stored: any = baseTask();
    prisma.task.findUnique.mockImplementation(() => Promise.resolve(stored));
    prisma.task.updateMany.mockImplementation(({ data }: any) => {
      stored = { ...stored, ...data }; const first = stored.startedAt;
      stored = { ...stored, completedAt: new Date() }; expect(stored.startedAt).toBe(first);
      return Promise.resolve({ count: 1 });
    });
    const result = await service.start(userId, 'task-1');
    expect(result.startedAt).toBe(stored.startedAt); expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('logs reminder cancellation failure without rejecting the persisted start', async () => {
    const { service, prisma, notifications } = setup(); let stored: any = baseTask();
    prisma.task.findUnique.mockImplementation(() => Promise.resolve(stored));
    prisma.task.updateMany.mockImplementation(({ data }: any) => { stored = { ...stored, ...data }; return Promise.resolve({ count: 1 }); });
    notifications.cancelTaskReminder.mockRejectedValue(new Error('queue down'));
    const log = jest.spyOn((service as any).logger, 'error').mockImplementation();
    await expect(service.start(userId, 'task-1')).resolves.toMatchObject({ startedAt: expect.any(Date) });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('task-1'), expect.any(Error));
  });

  it('generic update, completion, and reopening preserve startedAt and never reschedule', async () => {
    const { service, prisma, notifications } = setup(); const historical = new Date('2026-08-14T10:03:19Z');
    let stored: any = { ...baseTask(), startedAt: historical };
    prisma.task.findUnique.mockImplementation(() => Promise.resolve(stored));
    prisma.task.update.mockImplementation(({ data }: any) => { stored = { ...stored, ...data }; return Promise.resolve(stored); });
    await service.update(userId, stored.id, { title: 'Edited' });
    const completed = await service.toggleComplete(userId, stored.id); const reopened = await service.toggleComplete(userId, stored.id);
    expect(completed.startedAt).toBe(historical); expect(reopened.startedAt).toBe(historical);
    expect(reopened.completedAt).toBeNull(); expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    expect(notifications.cancelTaskReminder).toHaveBeenCalledTimes(3);
  });
});
