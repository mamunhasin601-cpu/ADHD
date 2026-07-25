import { TasksService } from './tasks.service';

describe('TasksService — синхронизация напоминаний', () => {
  let service: TasksService;
  let prisma: any;
  let notifications: any;

  const userId = 'user-1';

  beforeEach(() => {
    prisma = {
      task: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    notifications = {
      scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
      cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
    };
    service = new TasksService(prisma, notifications);
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
});
