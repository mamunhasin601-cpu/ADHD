import { TaskRecoveryService } from './task-recovery.service';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';

/**
 * Тесты TaskRecoveryService
 * Покрывают ADR-008 D-1..D-7, DST boundaries, ownership, stale state, atomicity
 */
describe('TaskRecoveryService', () => {
  let service: TaskRecoveryService;
  let prisma: any;
  let notifications: any;

  const userId = 'user-recovery-1';

  // Стандартная просроченная задача (вчера)
  const overdueTask = {
    id: 'task-overdue-1',
    userId,
    title: 'Просроченная задача',
    startTime: new Date('2026-08-03T10:00:00.000Z'), // вчера
    completedAt: null,
    isRecurring: false,
    parentTaskId: null,
    durationMinutes: 30,
    color: '#6B5BFC',
    recurrenceRule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([overdueTask]),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    notifications = {
      scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
      cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
    };

    service = new TaskRecoveryService(prisma, notifications);
  });

  //─────────────────────────────────────────────────────────
  // GET — overdue query
  // ─────────────────────────────────────────────────────────

  describe('getOverdueTasks()', () => {
    it('возвращает просроченные задачи с userTimezone и localDayStart', async () => {
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z'); // сегодня
      const result = await service.getOverdueTasks(userId, referenceInstant);

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-overdue-1');
      expect(result.userTimezone).toBe('Europe/Moscow');
      expect(result.localDayStart).toBeDefined();
    });

    it('передаёт корректный where-filter в Prisma', async () => {
      // Europe/Moscow = UTC+3, поэтому 2026-08-04T00:00:00+03 = 2026-08-03T21:00:00Z
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      await service.getOverdueTasks(userId, referenceInstant);

      const whereArg = prisma.task.findMany.mock.calls[0][0].where;
      expect(whereArg.userId).toBe(userId);
      expect(whereArg.parentTaskId).toBeNull();
      expect(whereArg.completedAt).toBeNull();
      expect(whereArg.isRecurring).toBe(false);
      expect(whereArg.startTime.not).toBeNull();
      expect(whereArg.startTime.lt).toBeInstanceOf(Date);
    });

    it('использует UTC как fallback timezone если user не найден', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      const result = await service.getOverdueTasks(userId, referenceInstant);
      expect(result.userTimezone).toBe('UTC');
    });

    it('localDayStart корректен для Europe/Moscow (UTC+3)', async () => {
      // Moscow midnight2026-08-04 00:00 = 2026-08-03 21:00 UTC
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      await service.getOverdueTasks(userId, referenceInstant);

      const whereArg = prisma.task.findMany.mock.calls[0][0].where;
      const localDayStart: Date = whereArg.startTime.lt;
      expect(localDayStart.toISOString()).toBe('2026-08-03T21:00:00.000Z');
    });

    it('localDayStart корректен для UTC', async () => {
      prisma.user.findUnique.mockResolvedValue({ timezone: 'UTC' });
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      await service.getOverdueTasks(userId, referenceInstant);

      const whereArg = prisma.task.findMany.mock.calls[0][0].where;
      const localDayStart: Date = whereArg.startTime.lt;
      expect(localDayStart.toISOString()).toBe('2026-08-04T00:00:00.000Z');
    });

    it('возвращает пустой массив если просроченных задач нет', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      const result = await service.getOverdueTasks(userId, new Date());
      expect(result.tasks).toHaveLength(0);
    });

    // ── DST boundary tests (ADR-008 D-2) ──

    it('DST spring forward (Europe/Moscow переход на летнее время): localDayStart не попадает в gap', async () => {
      // Russia-Moscow нет DST с 2014, используем America/New_York для DST теста
      prisma.user.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
      //2026-03-08: spring forward в02:00 -> 03:00 (EST->EDT, UTC-5->UTC-4)
      // 2026-03-0800:00 New_York = 2026-03-08 05:00:00Z
      const referenceInstant = new Date('2026-03-08T12:00:00.000Z');
      await service.getOverdueTasks(userId, referenceInstant);

      const whereArg = prisma.task.findMany.mock.calls[0][0].where;
      const localDayStart: Date = whereArg.startTime.lt;
      // EST midnight = UTC+5 offset
      expect(localDayStart.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    });

    it('DST fall back (America/New_York): localDayStart корректен при возврате на зимнее время', async () => {
      prisma.user.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
      // 2026-11-01: fall back в 02:00 -> 01:00 (EDT->EST, UTC-4->UTC-5)
      // 2026-11-01 00:00 New_York EDT = 2026-11-01 04:00:00Z
      const referenceInstant = new Date('2026-11-01T12:00:00.000Z');
      await service.getOverdueTasks(userId, referenceInstant);

      const whereArg = prisma.task.findMany.mock.calls[0][0].where;
      const localDayStart: Date = whereArg.startTime.lt;
      expect(localDayStart.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    });

    it('задача scheduled точно в localDayStart НЕ является overdue', async () => {
      // Если startTime === localDayStart, условие lt не выполняется → не overdue
      // Проверяем что фильтр использует lt (строго меньше), а не lte
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      await service.getOverdueTasks(userId, referenceInstant);

      const whereArg = prisma.task.findMany.mock.calls[0][0].where;
      // lt означает строго меньше
      expect(whereArg.startTime).toHaveProperty('lt');
      expect(whereArg.startTime).not.toHaveProperty('lte');
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST — reschedule
  // ─────────────────────────────────────────────────────────

  describe('rescheduleOverdueTasks()', () => {
    // futureTime is relative so the test does not rot when the clock passes a
    // hardcoded instant (Task 0007A: the F2 guard now rejects dest <= now).
    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const validItem = { taskId: overdueTask.id, targetStartTime: futureTime };

    /** Ownership row — достаточно для прохождения batch ownership check */
    const ownershipRow = {
      id: overdueTask.id,
      userId,
      completedAt: null,
      startTime: overdueTask.startTime,
      isRecurring: false,
      parentTaskId: null,
    };

    /**
     * Настраивает успешный сценарий для single-item future reschedule.
     * - первый findMany  → ownership check
     * - $transaction     → выполняет callback; updateMany возвращает { count: 1 }
     * - второй findMany  → post-commit reload для reminder sync
     */
    const setupValidTransaction = () => {
      prisma.task.findMany
        .mockResolvedValueOnce([ownershipRow])
        .mockResolvedValueOnce([{ ...overdueTask, startTime: new Date(futureTime) }]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 1 });
        return fn(prisma);
      });
    };

    /**
     * Настраивает сценарий где транзакция выбрасывает ConflictException
     * из-за updateMany вернувшего { count: 0 }.
     * Ownership check при этом проходит.
     */
    const setupStaleTransaction = (ownershipData = [ownershipRow]) => {
      prisma.task.findMany.mockResolvedValueOnce(ownershipData);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 0 });
        return fn(prisma);
      });
    };

    // ── Success: dated destination ────────────────────────

    it('успешно переносит задачу на future time', async () => {
      setupValidTransaction();
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      const result = await service.rescheduleOverdueTasks(
        userId,
        [validItem],
        referenceInstant,
      );

      expect(result.taskUpdateStatus).toBe('ok');
      expect(result.updatedCount).toBe(1);
      expect(result.reminderSyncStatus).toBe('ok');
      expect(notifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
    });

    it('updateMany включает все условия eligibility в where', async () => {
      setupValidTransaction();
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      await service.rescheduleOverdueTasks(userId, [validItem], referenceInstant);

      // Транзакция вызвала updateMany — убеждаемся что where содержит все guard-условия
      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: overdueTask.id,
            userId,
            completedAt: null,
            parentTaskId: null,
            isRecurring: false,
            startTime: { not: null, lt: expect.any(Date) },
          },
          data: { startTime: new Date(futureTime) },
        }),
      );
    });

    // ── Success: Inbox (null) destination ─────────────────

    it('успешно переносит задачу в Inbox (targetStartTime = null)', async () => {
      const inboxItem = { taskId: overdueTask.id, targetStartTime: null };

      prisma.task.findMany
        .mockResolvedValueOnce([ownershipRow])
        .mockResolvedValueOnce([{ ...overdueTask, startTime: null }]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 1 });
        return fn(prisma);
      });

      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      const result = await service.rescheduleOverdueTasks(
        userId,
        [inboxItem],
        referenceInstant,
      );

      expect(result.taskUpdateStatus).toBe('ok');
      // startTime=null после commit → reminder отменяется
      expect(notifications.cancelTaskReminder).toHaveBeenCalledWith(overdueTask.id);
      expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    });

    it('updateMany передаёт startTime: null для Inbox destination', async () => {
      const inboxItem = { taskId: overdueTask.id, targetStartTime: null };

      prisma.task.findMany
        .mockResolvedValueOnce([ownershipRow])
        .mockResolvedValueOnce([{ ...overdueTask, startTime: null }]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 1 });
        return fn(prisma);
      });

      await service.rescheduleOverdueTasks(
        userId,
        [inboxItem],
        new Date('2026-08-04T08:00:00.000Z'),
      );

      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { startTime: null } }),
      );
    });

    // ── Pre-transaction validation (unchanged) ────────────

    it('отклоняет пустой массив items (HTTP 422)', async () => {
      await expect(
        service.rescheduleOverdueTasks(userId, [], new Date()),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('отклоняет массив с duplicate taskId (HTTP 422)', async () => {
      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [validItem, validItem],
          new Date(),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('отклоняет targetStartTime до начала текущего дня (HTTP 422)', async () => {
      const pastItem = { taskId: overdueTask.id, targetStartTime: '2026-08-03T10:00:00.000Z' };
      // referenceInstant: 2026-08-04T08:00Z → still before reference → reject
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');

      await expect(
        service.rescheduleOverdueTasks(userId, [pastItem], referenceInstant),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    // ── Stricter future validation (Task 0007A finding 2) ─────────────────────
    // The previous check was "destination < localDayStart". It silently
    // committed tasks to times that had already passed today. Now we require
    // destination > referenceInstant so equal-to-now and earlier-today are
    // both rejected.

    it('отклоняет destination равный referenceInstant (equal-to-now → 422)', async () => {
      const ref = new Date('2026-08-04T08:00:00.000Z');
      const equalNowItem = { taskId: overdueTask.id, targetStartTime: ref.toISOString() };

      await expect(
        service.rescheduleOverdueTasks(userId, [equalNowItem], ref),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('отклоняет destination earlier-today (после полуночи, но до referenceInstant)', async () => {
      // referenceInstant 08:00 UTC; Moscow localDayStart = 2026-08-03T21:00Z (yesterday).
      // 2026-08-04T07:00:00Z is after Moscow midnight but BEFORE referenceInstant 08:00.
      const ref = new Date('2026-08-04T08:00:00.000Z');
      const earlierTodayItem = {
        taskId: overdueTask.id,
        targetStartTime: '2026-08-04T07:00:00.000Z',
      };

      await expect(
        service.rescheduleOverdueTasks(userId, [earlierTodayItem], ref),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('принимает destination на 1 мс позже referenceInstant', async () => {
      const ref = new Date('2026-08-04T08:00:00.000Z');
      const justFutureItem = {
        taskId: overdueTask.id,
        targetStartTime: new Date(ref.getTime() + 1).toISOString(),
      };

      // Set up valid transaction so it doesn't fail later.
      prisma.task.findMany
        .mockResolvedValueOnce([ownershipRow])
        .mockResolvedValueOnce([{ ...overdueTask, startTime: new Date(ref.getTime() + 1) }]);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 1 });
        return fn(prisma);
      });

      const result = await service.rescheduleOverdueTasks(userId, [justFutureItem], ref);
      expect(result.taskUpdateStatus).toBe('ok');
    });

    it('ни транзакция, ни updateMany не вызываются при equal-to-now rejection', async () => {
      const ref = new Date('2026-08-04T08:00:00.000Z');
      const equalNowItem = { taskId: overdueTask.id, targetStartTime: ref.toISOString() };

      await expect(
        service.rescheduleOverdueTasks(userId, [equalNowItem], ref),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('отклоняет foreign task (HTTP 403)', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: overdueTask.id,
          userId: 'other-user-id', // чужая задача
          completedAt: null,
          startTime: overdueTask.startTime,
          isRecurring: false,
          parentTaskId: null,
        },
      ]);

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('отклоняет несуществующий taskId (HTTP 403)', async () => {
      prisma.task.findMany.mockResolvedValue([]); // ничего не нашли

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('один foreign task в batch отклоняет весь batch до транзакции', async () => {
      const anotherTaskId = 'task-foreign-2';
      prisma.task.findMany.mockResolvedValue([
        {
          id: overdueTask.id,
          userId, // own
          completedAt: null,
          startTime: overdueTask.startTime,
          isRecurring: false,
          parentTaskId: null,
        },
        {
          id: anotherTaskId,
          userId: 'other-user', // foreign
          completedAt: null,
          startTime: overdueTask.startTime,
          isRecurring: false,
          parentTaskId: null,
        },
      ]);

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [
            validItem,
            { taskId: anotherTaskId, targetStartTime: futureTime },
          ],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(ForbiddenException);

      // Транзакция не должна была вызваться
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // ── Stale state via updateMany count: 0 ──────────────

    it('updateMany count: 0 → ConflictException с STALE_RECOVERY_STATE', async () => {
      setupStaleTransaction();

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [validItem],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(ConflictException);

      // Reminder sync не должен вызываться — транзакция не коммитилась
      expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
      expect(notifications.cancelTaskReminder).not.toHaveBeenCalled();
    });

    it('ConflictException содержит code: STALE_RECOVERY_STATE и staleTaskIds', async () => {
      setupStaleTransaction();

      let thrown: any;
      try {
        await service.rescheduleOverdueTasks(
          userId,
          [validItem],
          new Date('2026-08-04T08:00:00.000Z'),
        );
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBeInstanceOf(ConflictException);
      const body = thrown.getResponse() as any;
      expect(body.code).toBe('STALE_RECOVERY_STATE');
      expect(body.staleTaskIds).toContain(overdueTask.id);
    });

    it('zero count на втором item отклоняет транзакцию; reminder sync не вызывается', async () => {
      const secondTaskId = 'task-overdue-2';
      const secondTask = { ...overdueTask, id: secondTaskId };

      prisma.task.findMany.mockResolvedValueOnce([
        ownershipRow,
        { ...ownershipRow, id: secondTaskId },
      ]);

      // Первый updateMany успешен, второй — нет; транзакция откатывается (в unit mock через throw)
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany
          .mockResolvedValueOnce({ count: 1 }) // первый item ok
          .mockResolvedValueOnce({ count: 0 }); // второй item → ConflictException
        return fn(prisma);
      });

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [
            validItem,
            { taskId: secondTaskId, targetStartTime: futureTime },
          ],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(ConflictException);

      // Нет post-commit findMany → нет reminder sync
      expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
      expect(notifications.cancelTaskReminder).not.toHaveBeenCalled();
    });

    it('отклоняет уже выполненную задачу — стала stale в транзакции (HTTP 409)', async () => {
      // Ownership проходит; completedAt: null в updateMany where не совпадает → count: 0
      prisma.task.findMany.mockResolvedValueOnce([
        { ...ownershipRow, completedAt: new Date() },
      ]);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 0 });
        return fn(prisma);
      });

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date('2026-08-04T08:00:00.000Z')),
      ).rejects.toThrow(ConflictException);
    });

    it('отклоняет задачу с parentTaskId (subtask) — стала stale в транзакции (HTTP 409)', async () => {
      prisma.task.findMany.mockResolvedValueOnce([
        { ...ownershipRow, parentTaskId: 'some-parent-id' },
      ]);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 0 });
        return fn(prisma);
      });

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date('2026-08-04T08:00:00.000Z')),
      ).rejects.toThrow(ConflictException);
    });

    it('отклоняет isRecurring=true задачу — стала stale в транзакции (HTTP 409)', async () => {
      prisma.task.findMany.mockResolvedValueOnce([
        { ...ownershipRow, isRecurring: true },
      ]);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 0 });
        return fn(prisma);
      });

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date('2026-08-04T08:00:00.000Z')),
      ).rejects.toThrow(ConflictException);
    });

    it('отклоняет задачу, уже перенесённую в будущее — стала stale в транзакции (HTTP 409)', async () => {
      // startTime в будущем → lt localDayStart не выполняется → count: 0
      prisma.task.findMany.mockResolvedValueOnce([
        { ...ownershipRow, startTime: new Date('2026-08-05T10:00:00.000Z') },
      ]);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 0 });
        return fn(prisma);
      });

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date('2026-08-04T08:00:00.000Z')),
      ).rejects.toThrow(ConflictException);
    });

    it('повторный вызов с тем же mapping idempotent (stale 409 после первого успеха)', async () => {
      // После успешного reschedule задача больше не overdue (startTime в будущем)
      prisma.task.findMany.mockResolvedValueOnce([
        { ...ownershipRow, startTime: new Date(futureTime) },
      ]);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 0 });
        return fn(prisma);
      });

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [validItem],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(ConflictException);
    });

    // ── Reminder sync after commit ────────────────────────

    it('queue failure после commit не откатывает task update (ADR-008 D-4)', async () => {
      setupValidTransaction();
      notifications.scheduleTaskReminder.mockRejectedValue(new Error('Redis недоступен'));

      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');
      const result = await service.rescheduleOverdueTasks(
        userId,
        [validItem],
        referenceInstant,
      );

      // Task update должен быть ok несмотря на queue failure
      expect(result.taskUpdateStatus).toBe('ok');
      expect(result.updatedCount).toBe(1);
      // Reminder sync должен быть partial
      expect(result.reminderSyncStatus).toBe('partial');
      expect(result.failedReminderSyncs).toContain(overdueTask.id);
    });

    it('null targetStartTime отменяет reminder (Inbox flow)', async () => {
      const inboxTask = { ...overdueTask, startTime: null };

      prisma.task.findMany
        .mockResolvedValueOnce([ownershipRow])
        .mockResolvedValueOnce([inboxTask]);

      prisma.$transaction.mockImplementation(async (fn: any) => {
        prisma.task.updateMany.mockResolvedValue({ count: 1 });
        return fn(prisma);
      });

      await service.rescheduleOverdueTasks(
        userId,
        [{ taskId: overdueTask.id, targetStartTime: null }],
        new Date('2026-08-04T08:00:00.000Z'),
      );

      expect(notifications.cancelTaskReminder).toHaveBeenCalledWith(overdueTask.id);
      expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
    });

    // ── No write on pre-transaction rejection (Task 0007) ──
    // Раньше эти кейсы проверяли только факт исключения. Теперь доказываем,
    // что путь записи вообще не начинался — это и есть "no partial write".

    it('пустой items: ни транзакция, ни updateMany не вызываются', async () => {
      await expect(
        service.rescheduleOverdueTasks(userId, [], new Date()),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('duplicate taskId: ни транзакция, ни updateMany не вызываются', async () => {
      await expect(
        service.rescheduleOverdueTasks(userId, [validItem, validItem], new Date()),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('destination в прошлом: ни транзакция, ни updateMany не вызываются', async () => {
      const pastItem = {
        taskId: overdueTask.id,
        targetStartTime: '2026-08-03T10:00:00.000Z',
      };

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [pastItem],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('невалидный ISO-8601 в targetStartTime отклоняется сервисом (HTTP 422)', async () => {
      // Покрывает собственную guard-ветку сервиса (isNaN(dest.getTime())).
      // На реальном маршруте это отсекает DTO, но сервис не должен полагаться
      // только на валидацию транспортного слоя.
      const badItem = { taskId: overdueTask.id, targetStartTime: 'не дата' };

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [badItem],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('foreign task: updateMany не вызывается (не только транзакция)', async () => {
      prisma.task.findMany.mockResolvedValue([
        { ...ownershipRow, userId: 'other-user-id' },
      ]);

      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], new Date()),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    // ── Idempotent repeat submission (Task 0007) ──────────
    // ADR-008 / AC 0001-10: повторная отправка того же подтверждённого запроса
    // не должна давать ни повторной записи, ни повторной доставки напоминания.

    it('повторная отправка того же payload: вторая запись не применяется', async () => {
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');

      prisma.task.findMany
        // Вызов 1: ownership → задача ещё overdue
        .mockResolvedValueOnce([ownershipRow])
        // Вызов 1: post-commit reload → уже перенесена
        .mockResolvedValueOnce([{ ...overdueTask, startTime: new Date(futureTime) }])
        // Вызов 2: ownership → задача уже НЕ overdue
        .mockResolvedValueOnce([{ ...ownershipRow, startTime: new Date(futureTime) }]);

      let transactionCalls = 0;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        transactionCalls += 1;
        // Первый заход находит подходящую строку, второй — нет (startTime уже в будущем)
        prisma.task.updateMany.mockResolvedValue({
          count: transactionCalls === 1 ? 1 : 0,
        });
        return fn(prisma);
      });

      // Первая отправка применяется
      const first = await service.rescheduleOverdueTasks(
        userId,
        [validItem],
        referenceInstant,
      );
      expect(first.updatedCount).toBe(1);
      expect(first.taskUpdateStatus).toBe('ok');

      // Повторная отправка того же payload отклоняется как stale
      await expect(
        service.rescheduleOverdueTasks(userId, [validItem], referenceInstant),
      ).rejects.toThrow(ConflictException);

      // Ключевое: напоминание доставлено ровно один раз, дублей нет
      expect(notifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
    });

    it('повторная отправка Inbox-переноса не отменяет reminder второй раз', async () => {
      const inboxItem = { taskId: overdueTask.id, targetStartTime: null };
      const referenceInstant = new Date('2026-08-04T08:00:00.000Z');

      prisma.task.findMany
        .mockResolvedValueOnce([ownershipRow])
        .mockResolvedValueOnce([{ ...overdueTask, startTime: null }])
        // Вызов 2: задача уже в Inbox (startTime: null) → не overdue
        .mockResolvedValueOnce([{ ...ownershipRow, startTime: null }]);

      let transactionCalls = 0;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        transactionCalls += 1;
        prisma.task.updateMany.mockResolvedValue({
          count: transactionCalls === 1 ? 1 : 0,
        });
        return fn(prisma);
      });

      await service.rescheduleOverdueTasks(userId, [inboxItem], referenceInstant);

      await expect(
        service.rescheduleOverdueTasks(userId, [inboxItem], referenceInstant),
      ).rejects.toThrow(ConflictException);

      expect(notifications.cancelTaskReminder).toHaveBeenCalledTimes(1);
    });

    it('stale второй вызов не делает post-commit reload (нет reminder sync)', async () => {
      setupStaleTransaction();

      await expect(
        service.rescheduleOverdueTasks(
          userId,
          [validItem],
          new Date('2026-08-04T08:00:00.000Z'),
        ),
      ).rejects.toThrow(ConflictException);

      expect(notifications.scheduleTaskReminder).not.toHaveBeenCalled();
      expect(notifications.cancelTaskReminder).not.toHaveBeenCalled();
    });

    // ── Logging contract (Task 0007A finding 5) ─────────────────────────────────
    // Recovery log lines must carry outcome/counts but no userId, task ids, or
    // task titles. Spy on the private logger and assert on the message strings.

    describe('observability contract — no PII in log lines', () => {
      let debugSpy: jest.SpyInstance;
      let logSpy: jest.SpyInstance;
      let warnSpy: jest.SpyInstance;
      let errorSpy: jest.SpyInstance;

      beforeEach(() => {
        const logger = (service as any).logger;
        debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
        logSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});
        warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('getOverdueTasks: log contains outcome, overdueCount and latencyMs — no PII or infra fields', async () => {
        const ref = new Date('2026-08-04T08:00:00.000Z');
        await service.getOverdueTasks(userId, ref);

        expect(debugSpy).toHaveBeenCalledTimes(1);
        const msg: string = debugSpy.mock.calls[0][0];

        // Allowed fields (Package 0001 / ADR-008 / Task 0009)
        expect(msg).toContain('outcome=ok');
        expect(msg).toContain('overdueCount=');
        expect(msg).toMatch(/latencyMs=\d+/);

        // Forbidden fields — none of these must appear
        expect(msg).not.toContain(userId);                   // no userId
        expect(msg).not.toContain(overdueTask.id);           // no taskId
        expect(msg).not.toContain('timezone=');              // no timezone
        expect(msg).not.toContain('localDayStart=');         // no day boundary
      });

      it('reschedule success: log has outcome, updatedCount, latencyMs, no PII', async () => {
        const ref = new Date('2026-08-04T08:00:00.000Z');
        const futureItem = {
          taskId: overdueTask.id,
          targetStartTime: new Date(ref.getTime() + 60_000).toISOString(),
        };

        prisma.task.findMany
          .mockResolvedValueOnce([ownershipRow])
          .mockResolvedValueOnce([{ ...overdueTask, startTime: new Date(ref.getTime() + 60_000) }]);
        prisma.$transaction.mockImplementation(async (fn: any) => {
          prisma.task.updateMany.mockResolvedValue({ count: 1 });
          return fn(prisma);
        });

        await service.rescheduleOverdueTasks(userId, [futureItem], ref);

        expect(logSpy).toHaveBeenCalledTimes(1);
        const msg: string = logSpy.mock.calls[0][0];

        // Allowed fields (Package 0001 / ADR-008 / Task 0009)
        expect(msg).toContain('outcome=ok');
        expect(msg).toContain('updatedCount=');
        expect(msg).toMatch(/latencyMs=\d+/);

        // Forbidden fields
        expect(msg).not.toContain(userId);
        expect(msg).not.toContain(overdueTask.id);
        expect(msg).not.toContain('timezone=');
        expect(msg).not.toContain('localDayStart=');
      });

      it('reminder sync failure: error log has failureClass, no taskId or userId', async () => {
        const ref = new Date('2026-08-04T08:00:00.000Z');
        const futureItem = {
          taskId: overdueTask.id,
          targetStartTime: new Date(ref.getTime() + 60_000).toISOString(),
        };

        prisma.task.findMany
          .mockResolvedValueOnce([ownershipRow])
          .mockResolvedValueOnce([{ ...overdueTask, startTime: new Date(ref.getTime() + 60_000) }]);
        prisma.$transaction.mockImplementation(async (fn: any) => {
          prisma.task.updateMany.mockResolvedValue({ count: 1 });
          return fn(prisma);
        });
        notifications.scheduleTaskReminder.mockRejectedValue(new Error('Redis down'));

        await service.rescheduleOverdueTasks(userId, [futureItem], ref);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        const errMsg: string = errorSpy.mock.calls[0][0];
        expect(errMsg).toContain('failureClass=');
        expect(errMsg).not.toContain(overdueTask.id);
        expect(errMsg).not.toContain(userId);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const warnMsg: string = warnSpy.mock.calls[0][0];

        // Allowed fields (Package 0001 / ADR-008 / Task 0010)
        expect(warnMsg).toContain('reminderSyncStatus=partial');
        expect(warnMsg).toContain('committedCount=');
        expect(warnMsg).toContain('failedReminderCount=');
        expect(warnMsg).toMatch(/latencyMs=\d+/);

        // Forbidden fields
        expect(warnMsg).not.toContain(userId);
        expect(warnMsg).not.toContain(overdueTask.id);
        expect(warnMsg).not.toContain('timezone=');
        expect(warnMsg).not.toContain('localDayStart=');
      });
    });
  });
});
