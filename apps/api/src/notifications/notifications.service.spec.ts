import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TASK_REMINDERS_QUEUE, JOBS } from './notifications.constants';
import type { Task } from '@prisma/client';

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

const mockPrisma = {
  user: { findUnique: jest.fn() },
  notificationLog: { create: jest.fn() },
};

// Мокаем fetch глобально
global.fetch = jest.fn();

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getQueueToken(TASK_REMINDERS_QUEUE), useValue: mockQueue },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockQueue.getJob.mockResolvedValue(null); // нет существующих job по умолчанию
  });

  // ──────────────────────────────────────────────
  // scheduleTaskReminder
  // ──────────────────────────────────────────────

  describe('scheduleTaskReminder', () => {
    it('добавляет job в очередь если startTime в будущем', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // через 1 час

      const task = {
        id: 'task-uuid-1',
        userId: 'user-uuid-1',
        title: 'Спорт',
        startTime: futureDate,
      } as Task;

      await service.scheduleTaskReminder(task);

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOBS.TASK_REMINDER,
        expect.objectContaining({ taskId: 'task-uuid-1', userId: 'user-uuid-1' }),
        expect.objectContaining({
          jobId: 'task-reminder-task-uuid-1',
          delay: expect.any(Number),
        }),
      );

      const callArgs = mockQueue.add.mock.calls[0][2];
      expect(callArgs.delay).toBeGreaterThan(0);
    });

    it('не добавляет job если startTime в прошлом', async () => {
      const pastDate = new Date(Date.now() - 60_000); // минуту назад

      const task = { id: 'task-2', userId: 'user-1', title: 'Завтрак', startTime: pastDate } as Task;

      await service.scheduleTaskReminder(task);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('не добавляет job если startTime = null', async () => {
      const task = { id: 'task-3', userId: 'user-1', title: 'Без времени', startTime: null } as Task;

      await service.scheduleTaskReminder(task);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('отменяет старый job перед добавлением нового (перепланирование)', async () => {
      const existingJob = { remove: jest.fn() };
      mockQueue.getJob.mockResolvedValueOnce(existingJob);

      const futureDate = new Date(Date.now() + 30 * 60_000);
      const task = { id: 'task-4', userId: 'user-1', title: 'Обед', startTime: futureDate } as Task;

      await service.scheduleTaskReminder(task);

      expect(existingJob.remove).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // sendPushNotification
  // ──────────────────────────────────────────────

  describe('sendPushNotification', () => {
    it('отправляет запрос к Expo API и возвращает true при статусе ok', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        expoPushToken: 'ExponentPushToken[xxxxxx]',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ data: { status: 'ok' } }),
      });

      const result = await service.sendPushNotification('user-1', '⏰ Время!', 'Задача: Спорт');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('возвращает false если нет push-токена у пользователя', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ expoPushToken: null });

      const result = await service.sendPushNotification('user-1', 'Тест', 'Тест');

      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('возвращает false при ошибке сети (не бросает исключение)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        expoPushToken: 'ExponentPushToken[xxxxxx]',
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.sendPushNotification('user-1', 'Тест', 'Тест');

      expect(result).toBe(false); // не выбрасывает, возвращает false → retry через BullMQ
    });
  });

  // ──────────────────────────────────────────────
  // logNotification
  // ──────────────────────────────────────────────

  describe('logNotification', () => {
    it('создаёт запись в NotificationLog', async () => {
      mockPrisma.notificationLog.create.mockResolvedValue({});

      await service.logNotification('user-1', 'task-1', true);

      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', taskId: 'task-1', delivered: true },
      });
    });
  });
});
