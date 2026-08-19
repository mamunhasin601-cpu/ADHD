import { NotificationsService } from './notifications.service';
import { ConflictException } from '@nestjs/common';
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
      deviceToken: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      notificationLog: { findFirst: jest.fn(), create: jest.fn() },
    };
    service = new NotificationsService(queue as any, prisma as any);
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── scheduleTaskReminder ──────────────────────────────────────────────────

  describe('scheduleTaskReminder', () => {
    it.each(['REST', 'BUFFER'] as const)('cancels a stale job and never schedules a %s block', async (kind) => {
      const job = { remove: jest.fn().mockResolvedValue(undefined) };
      queue.getJob.mockResolvedValueOnce(job);
      await service.scheduleTaskReminder({
        ...baseTask,
        kind,
        startTime: new Date('2026-07-25T10:30:00.000Z'),
      });

      expect(queue.getJob).toHaveBeenCalledWith('task-reminder-task-1');
      expect(job.remove).toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('keeps an omitted legacy kind compatible with TASK scheduling', async () => {
      await service.scheduleTaskReminder({
        ...baseTask,
        startTime: new Date('2026-07-25T10:30:00.000Z'),
      });
      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('ставит job с корректным delay и детерминированным jobId', async () => {
      const task = { ...baseTask, startTime: new Date('2026-07-25T10:30:00.000Z') };

      await service.scheduleTaskReminder(task);

      expect(queue.add).toHaveBeenCalledWith(
        'task-reminder',
        // taskTitle MUST NOT be in the job payload (ADR-009 privacy contract)
        expect.not.objectContaining({ taskTitle: expect.anything() }),
        expect.objectContaining({
          jobId: 'task-reminder-task-1',
          delay: 30 * 60_000,
          attempts: 3,
        }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'task-reminder',
        expect.objectContaining({ taskId: 'task-1', userId: 'user-1' }),
        expect.anything(),
      );
    });

    it('не включает taskTitle в job payload (ADR-009 конфиденциальность)', async () => {
      const task = { ...baseTask, startTime: new Date('2026-07-25T10:30:00.000Z') };
      await service.scheduleTaskReminder(task);

      const jobData = queue.add.mock.calls[0][1];
      expect(jobData).not.toHaveProperty('taskTitle');
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

    it('перед постановкой всегда отменяет предыдущее напоминание по этой задаче', async () => {
      const existingJob = { remove: jest.fn().mockResolvedValue(undefined) };
      queue.getJob.mockResolvedValueOnce(existingJob);
      const task = { ...baseTask, startTime: new Date('2026-07-25T10:30:00.000Z') };

      await service.scheduleTaskReminder(task);

      expect(queue.getJob).toHaveBeenCalledWith('task-reminder-task-1');
      expect(existingJob.remove).toHaveBeenCalled();
    });

    it('корректно считает delay независимо от локального часового пояса сервера (DST-safety)', async () => {
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

  // ── cancelTaskReminder ────────────────────────────────────────────────────

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

  // ── sendPushNotification (multi-device fan-out) ───────────────────────────

  describe('sendPushNotification', () => {
    it('возвращает no-tokens, если нет ни DeviceToken записей, ни legacy expoPushToken', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: null });
      // wasRecentlyDelivered not called when no tokens
      prisma.notificationLog.findFirst.mockResolvedValue(null);

      const result = await service.sendPushNotification('user-1', 'task-1');
      expect(result).toEqual({ status: 'no-tokens' });
    });

    it('отправляет на все активные DeviceToken пользователя (fan-out)', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-1', token: 'ExponentPushToken[tok1]' },
        { id: 'dev-2', token: 'ExponentPushToken[tok2]' },
      ]);
      prisma.notificationLog.findFirst.mockResolvedValue(null); // not yet delivered
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ data: { status: 'ok' } }),
      }) as any;

      const result = await service.sendPushNotification('user-1', 'task-1');
      expect(result.status).toBe('sent');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('возвращает sent при успешной отправке через legacy token', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: 'ExponentPushToken[abc]' });
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ data: { status: 'ok' } }),
      }) as any;

      const result = await service.sendPushNotification('user-1', 'task-1');
      expect(result.status).toBe('sent');
    });

    it('отзывает DeviceToken при DeviceNotRegistered (не legacy)', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-dead', token: 'ExponentPushToken[dead]' },
      ]);
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          data: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        }),
      }) as any;

      await service.sendPushNotification('user-1', 'task-1');

      expect(prisma.deviceToken.update).toHaveBeenCalledWith({
        where: { id: 'dev-dead' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('очищает legacy expoPushToken при DeviceNotRegistered', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ expoPushToken: 'ExponentPushToken[dead]' });
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          data: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        }),
      }) as any;

      await service.sendPushNotification('user-1', 'task-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { expoPushToken: null },
      });
    });

    it('push body не содержит task title или user content (конфиденциальность)', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-1', token: 'ExponentPushToken[tok1]' },
      ]);
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ data: { status: 'ok' } }),
      }) as any;

      await service.sendPushNotification('user-1', 'task-1');

      const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchBody).not.toHaveProperty('taskTitle');
      expect(fetchBody).not.toHaveProperty('userId');
      expect(fetchBody).not.toHaveProperty('taskId');
      // title and body must be generic strings
      expect(typeof fetchBody.title).toBe('string');
      expect(fetchBody.body).not.toMatch(/задача|task|title/i);
      // data must not expose sensitive fields
      expect(fetchBody.data).not.toHaveProperty('taskTitle');
      expect(fetchBody.data).not.toHaveProperty('userId');
    });

    it('возвращает all-failed при сетевой ошибке', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-1', token: 'ExponentPushToken[tok1]' },
      ]);
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

      const result = await service.sendPushNotification('user-1', 'task-1');
      expect(result.status).toBe('all-failed');
    });

    it('partial fan-out: одно устройство успешно, другое с retryable ошибкой — возвращает sent', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-ok', token: 'ExponentPushToken[ok]' },
        { id: 'dev-err', token: 'ExponentPushToken[err]' },
      ]);
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ json: async () => ({ data: { status: 'ok' } }) })
        .mockRejectedValueOnce(new Error('network blip')) as any;

      const result = await service.sendPushNotification('user-1', 'task-1');

      // Overall result is sent because at least one device succeeded.
      expect(result.status).toBe('sent');
      // Both devices were attempted — retryable failure on one does not skip the other.
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('partial fan-out: успешное устройство не дублируется при повторной попытке неуспешного', async () => {
      // Device 1 succeeds, device 2 gets DeviceNotRegistered (revoked).
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-1', token: 'ExponentPushToken[dev1]' },
        { id: 'dev-dead', token: 'ExponentPushToken[dead]' },
      ]);
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ json: async () => ({ data: { status: 'ok' } }) })
        .mockResolvedValueOnce({
          json: async () => ({
            data: { status: 'error', details: { error: 'DeviceNotRegistered' } },
          }),
        }) as any;

      const result = await service.sendPushNotification('user-1', 'task-1');

      expect(result.status).toBe('sent');
      // Invalid token is revoked — only this device's row updated.
      expect(prisma.deviceToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'dev-dead' } }),
      );
      // The successful device's row is NOT revoked.
      expect(prisma.deviceToken.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'dev-1' } }),
      );
    });

    it('пропускает устройство с уже доставленным напоминанием (per-device dedup, 0011B)', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([
        { id: 'dev-already', token: 'ExponentPushToken[already]' },
        { id: 'dev-new', token: 'ExponentPushToken[new]' },
      ]);
      // dev-already was delivered; dev-new was not
      prisma.notificationLog.findFirst
        .mockResolvedValueOnce({ id: 'log-prev' })  // dev-already → delivered
        .mockResolvedValueOnce(null);               // dev-new → not delivered
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ data: { status: 'ok' } }),
      }) as any;

      const result = await service.sendPushNotification('user-1', 'task-1');

      expect(result.status).toBe('sent');
      // Only dev-new was actually sent; dev-already was skipped
      expect(global.fetch).toHaveBeenCalledTimes(1);

      if (result.status === 'sent') {
        const alreadyDevice = result.devices.find((d) => d.tokenId === 'dev-already');
        const newDevice = result.devices.find((d) => d.tokenId === 'dev-new');
        expect(alreadyDevice?.outcome).toBe('already-delivered');
        expect(newDevice?.outcome).toBe('sent');
      }
    });
  });

  // ── registerDeviceToken ───────────────────────────────────────────────────

  describe('registerDeviceToken', () => {
    it('создаёт новый DeviceToken', async () => {
      const newToken = { id: 'dev-new', token: 'ExponentPushToken[new]', platform: 'expo' };
      prisma.deviceToken.findUnique.mockResolvedValue(null);
      prisma.deviceToken.create.mockResolvedValue(newToken);

      const result = await service.registerDeviceToken('user-1', 'ExponentPushToken[new]', 'expo');

      expect(prisma.deviceToken.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', token: 'ExponentPushToken[new]', platform: 'expo', label: undefined },
      });
      expect(result.id).toBe('dev-new');
    });

    it('возвращает существующий активный токен без изменений', async () => {
      const existing = { id: 'dev-existing', token: 'ExponentPushToken[ex]', userId: 'user-1', platform: 'expo', revokedAt: null };
      prisma.deviceToken.findUnique.mockResolvedValue(existing);

      const result = await service.registerDeviceToken('user-1', 'ExponentPushToken[ex]', 'expo');

      expect(prisma.deviceToken.create).not.toHaveBeenCalled();
      expect(result.id).toBe('dev-existing');
    });

    it('восстанавливает ранее отозванный токен того же пользователя', async () => {
      const revoked = { id: 'dev-rev', token: 'ExponentPushToken[rev]', userId: 'user-1', platform: 'expo', revokedAt: new Date() };
      prisma.deviceToken.findUnique.mockResolvedValue(revoked);
      prisma.deviceToken.update.mockResolvedValue({ ...revoked, revokedAt: null });

      const result = await service.registerDeviceToken('user-1', 'ExponentPushToken[rev]', 'expo');

      expect(prisma.deviceToken.update).toHaveBeenCalledWith({
        where: { id: 'dev-rev' },
        data: expect.objectContaining({ revokedAt: null }),
      });
      expect(result.id).toBe('dev-rev');
    });
    it('выбрасывает ConflictException при попытке зарегистрировать токен другого пользователя', async () => {
      const foreignToken = {
        id: 'dev-foreign',
        token: 'ExponentPushToken[foreign]',
        userId: 'other-user',
        platform: 'expo',
        revokedAt: null,
        label: null,
        createdAt: new Date(),
      };
      prisma.deviceToken.findUnique.mockResolvedValue(foreignToken);

      await expect(
        service.registerDeviceToken('user-1', 'ExponentPushToken[foreign]', 'expo'),
      ).rejects.toThrow(ConflictException);

      // No write must have occurred.
      expect(prisma.deviceToken.create).not.toHaveBeenCalled();
      expect(prisma.deviceToken.update).not.toHaveBeenCalled();
    });
  });

  describe('removeDeviceToken', () => {
    it('отзывает токен принадлежащий пользователю', async () => {
      prisma.deviceToken.findUnique.mockResolvedValue({ id: 'dev-1', userId: 'user-1' });
      prisma.deviceToken.update.mockResolvedValue({});

      const result = await service.removeDeviceToken('user-1', 'dev-1');

      expect(result).toBe(true);
      expect(prisma.deviceToken.update).toHaveBeenCalledWith({
        where: { id: 'dev-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('возвращает false при попытке удалить чужой токен', async () => {
      prisma.deviceToken.findUnique.mockResolvedValue({ id: 'dev-1', userId: 'other-user' });

      const result = await service.removeDeviceToken('user-1', 'dev-1');

      expect(result).toBe(false);
      expect(prisma.deviceToken.update).not.toHaveBeenCalled();
    });

    it('возвращает false если токен не найден', async () => {
      prisma.deviceToken.findUnique.mockResolvedValue(null);

      const result = await service.removeDeviceToken('user-1', 'dev-1');

      expect(result).toBe(false);
    });
  });

  // ── wasRecentlyDelivered ──────────────────────────────────────────────────

  describe('wasRecentlyDelivered', () => {
    it('возвращает true, если недавно была успешная доставка', async () => {
      prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1' });
      await expect(service.wasRecentlyDelivered('task-1')).resolves.toBe(true);
    });

    it('возвращает false, если свежих доставок нет', async () => {
      prisma.notificationLog.findFirst.mockResolvedValue(null);
      await expect(service.wasRecentlyDelivered('task-1')).resolves.toBe(false);
    });

    it('включает deviceTokenId в where при per-device проверке', async () => {
      prisma.notificationLog.findFirst.mockResolvedValue({ id: 'log-1' });

      await service.wasRecentlyDelivered('task-1', 'dev-42');

      expect(prisma.notificationLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deviceTokenId: 'dev-42' }),
        }),
      );
    });

    it('не включает deviceTokenId при task-level проверке (legacy path)', async () => {
      prisma.notificationLog.findFirst.mockResolvedValue(null);

      await service.wasRecentlyDelivered('task-1');

      const callArgs = prisma.notificationLog.findFirst.mock.calls[0][0];
      expect(callArgs?.where).not.toHaveProperty('deviceTokenId');
    });
  });
});
