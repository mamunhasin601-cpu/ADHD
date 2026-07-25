import { NotificationsService } from './notifications.service';
import type { Task } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queue: { add: jest.Mock; getJob: jest.Mock };
  let prisma: any;

  const baseTask: Task = {
    id: 'task-1',
    userId: 'user-1',
    title: 'Тестовая задача',
    startTime: null,
    durationMinutes: 30,
    color: '#6B5BFC',
    isRecurring: false,
    recurrenceRule: null,
    parentTaskId: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Task;

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(null),
    };
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      notificationLog: { findFirst: jest.fn(), create: jest.fn() },
    };
    service = new NotificationsService(queue as any, prisma as any);
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('scheduleTaskReminder', () => {
    it('ставит job с корректным delay и детерминированным jobId', async () => {
      const task = { ...baseTask, startTime: new Date('2026-07-25T10:30:00.000Z') };

      await service.scheduleTaskReminder(task);

      expect(queue.add).toHaveBeenCalledWith(
        'task-reminder',
        expect.objectContaining({ taskId: 'task-1', userId: 'user-1' }),
        expect.objectContaining({
          jobId: 'task-reminder-task-1',
          delay: 30 * 60_000,
          attempts: 3,
        }),
      );
    });

    it('не ставит напоминание, если startTime не задан', async () => {
      await service.scheduleTaskReminder(baseTask);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('не ставит напоминание, если startTime уже прошёл', async () => {
      const task = { ...baseTask, startTime: new Date('2026-07-25T09:59:56.000Z') };
      await service.scheduleTaskReminder(task);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('перед постановкой всегда отменяет предыдущее напоминание по этой задаче (защита от задвоения)', async () => {
      const existingJob = { remove: jest.fn().mockResolvedValue(undefined) };
      queue.getJob.mockResolvedValueOnce(existingJob);
      const task = { ...baseTask, startTime: new Date('2026-07-25T10:30:00.000Z') };

      await service.scheduleTaskReminder(task);

      expect(queue.getJob).toHaveBeenCalledWith('task-reminder-task-1');
      expect(existingJob.remove).toHaveBeenCalled();
    });

    it('корректно считает delay независимо от локального часового пояса сервера (DST-safety)', async () => {
      // Date хранит абсолютный момент времени (epoch), поэтому смена локального TZ
      // процесса не должна влиять на разницу startTime - now. Проверяем на TZ с DST
      // (в самой РФ DST отменён с 2014 года, но сервер/CI может быть настроен иначе).
      const originalTZ = process.env.TZ;
      process.env.TZ = 'America/New_York';

      const task = { ...baseTask, startTime: new Date('2026-07-25T11:15:00.000Z') };
      await service.scheduleTaskReminder(task);

      expect(queue.add).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ delay: 75 * 60_000 }),
      );

      process.env.TZ = originalTZ;
    });
  });

  describe('cancelTaskReminder', () => {
    it('удаляет job, если он существует', async () => {
      const job = { remove: jest.fn().mockResolvedValue(undefined) };
      queue.getJob.mockResolvedValueOnce(job);

      await service.cancelTaskReminder('task-1');

      expect(job.remove).toHaveBeenCalled();
    });

    it('ничего не делает, если job не найден', async () => {
      queue.getJob.mockResolvedValueOnce(null);
      await expect(service.cancelTaskReminder('task-1')).resolves.not.toThrow();
    });
  });

  describe('sendPushNotification', () => {
    it('возвращает no-token, если у пользователя нет expoPushToken', async () => {
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: null });
      const result = await service.sendPushNotification('user-1', 'Заголовок', 'Текст');
      expect(result).toEqual({ status: 'no-token' });
    });

    it('возвращает sent при успешном ответе Expo', async () => {
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: 'ExponentPushToken[abc]' });
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ data: { status: 'ok' } }),
      }) as any;

      const result = await service.sendPushNotification('user-1', 'Заголовок', 'Текст');
      expect(result).toEqual({ status: 'sent' });
    });

    it('очищает токен и возвращает device-not-registered при мёртвом токене', async () => {
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: 'ExponentPushToken[dead]' });
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          data: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        }),
      }) as any;

      const result = await service.sendPushNotification('user-1', 'Заголовок', 'Текст');

      expect(result).toEqual({ status: 'device-not-registered' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { expoPushToken: null },
      });
    });

    it('возвращает error при прочих ошибках Expo или сети', async () => {
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: 'ExponentPushToken[abc]' });
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

      const result = await service.sendPushNotification('user-1', 'Заголовок', 'Текст');
      expect(result).toEqual({ status: 'error', message: 'network down' });
    });
  });

  describe('wasRecentlyDelivered', () => {
    it('возвращает true, если недавно была успешная доставка', async () => {
      prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1' });
      await expect(service.wasRecentlyDelivered('task-1')).resolves.toBe(true);
    });

    it('возвращает false, если свежих доставок нет', async () => {
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      await expect(service.wasRecentlyDelivered('task-1')).resolves.toBe(false);
    });
  });
});
