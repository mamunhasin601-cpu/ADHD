import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';

/**
 * Integration-уровень тесты для recovery endpoints контроллера.
 *
 * Покрывают:
 * - GET /tasks/recovery → делегирует в TaskRecoveryService.getOverdueTasks
 * - POST /tasks/recovery/reschedule → делегирует в TaskRecoveryService.rescheduleOverdueTasks
 * - Правильная передача userId из @CurrentUser()
 * - Проброс исключений (403, 409, 422) без трансформации
 *
 * Не тестируют: JWT guard, database, queue — эти слои покрыты своими юнит-тестами.
 */
describe('TasksController — recovery routes', () => {
  let controller: TasksController;
  let recoveryService: jest.Mocked<TaskRecoveryService>;

  const mockUser = {
    id: 'user-ctrl-1',
    email: 'ctrl@test.local',
    timezone: 'Europe/Moscow',
  } as any;

  const overdueTask = {
    id: 'task-overdue-ctrl',
    userId: mockUser.id,
    title: 'Контроллерная задача',
    startTime: new Date('2026-08-03T10:00:00.000Z'),
    completedAt: null,
    isRecurring: false,
    parentTaskId: null,
    durationMinutes: 30,
    color: '#6B5BFC',
  } as any;

  const recoveryResponse = {
    tasks: [overdueTask],
    userTimezone: 'Europe/Moscow',
    localDayStart: '2026-08-03T21:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            toggleComplete: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: TaskRecoveryService,
          useValue: {
            getOverdueTasks: jest.fn(),
            rescheduleOverdueTasks: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    recoveryService = module.get(TaskRecoveryService) as jest.Mocked<TaskRecoveryService>;
  });

  // ─────────────────────────────────────────────────────────
  // GET /tasks/recovery
  // ─────────────────────────────────────────────────────────

  describe('GET /tasks/recovery', () => {
    it('делегирует в TaskRecoveryService.getOverdueTasks с userId из @CurrentUser()', async () => {
      recoveryService.getOverdueTasks.mockResolvedValue(recoveryResponse);

      const result = await controller.getOverdueTasks(mockUser, {} as any);

      expect(recoveryService.getOverdueTasks).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(recoveryResponse);
    });

    it('возвращает пустой список если просроченных задач нет', async () => {
      const emptyResponse = {
        tasks: [],
        userTimezone: 'Europe/Moscow',
        localDayStart: '2026-08-03T21:00:00.000Z',
      };
      recoveryService.getOverdueTasks.mockResolvedValue(emptyResponse);

      const result = await controller.getOverdueTasks(mockUser, {} as any);

      expect(result.tasks).toHaveLength(0);
      expect(result.userTimezone).toBe('Europe/Moscow');
    });

    it('пробрасывает исключения из сервиса без трансформации', async () => {
      recoveryService.getOverdueTasks.mockRejectedValue(new Error('DB unavailable'));

      await expect(controller.getOverdueTasks(mockUser, {} as any)).rejects.toThrow(
        'DB unavailable',
      );
    });

    it('не передаёт userId из тела запроса — только из @CurrentUser()', async () => {
      recoveryService.getOverdueTasks.mockResolvedValue(recoveryResponse);

      await controller.getOverdueTasks(mockUser, { date: '2026-08-04' } as any);

      // Контроллер передаёт только user.id — не query.userId и не никакой другой источник
      const callArgs = recoveryService.getOverdueTasks.mock.calls[0];
      expect(callArgs[0]).toBe(mockUser.id);
      expect(callArgs.length).toBe(1); // только userId
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /tasks/recovery/reschedule
  // ─────────────────────────────────────────────────────────

  describe('POST /tasks/recovery/reschedule', () => {
    const futureTime = '2026-08-05T10:00:00.000Z';

    const validDto = {
      items: [{ taskId: overdueTask.id, targetStartTime: futureTime }],
    } as any;

    const successResponse = {
      updatedCount: 1,
      taskUpdateStatus: 'ok' as const,
      reminderSyncStatus: 'ok' as const,
    };

    it('делегирует в TaskRecoveryService.rescheduleOverdueTasks с userId и items', async () => {
      recoveryService.rescheduleOverdueTasks.mockResolvedValue(successResponse);

      const result = await controller.rescheduleOverdueTasks(mockUser, validDto);

      expect(recoveryService.rescheduleOverdueTasks).toHaveBeenCalledWith(
        mockUser.id,
        validDto.items,
      );
      expect(result).toEqual(successResponse);
    });

    it('возвращает taskUpdateStatus: ok и updatedCount при успехе', async () => {
      recoveryService.rescheduleOverdueTasks.mockResolvedValue(successResponse);

      const result = await controller.rescheduleOverdueTasks(mockUser, validDto);

      expect(result.taskUpdateStatus).toBe('ok');
      expect(result.updatedCount).toBe(1);
    });

    it('возвращает reminderSyncStatus: partial если queue недоступен', async () => {
      const partialResponse = {
        updatedCount: 1,
        taskUpdateStatus: 'ok' as const,
        reminderSyncStatus: 'partial' as const,
        failedReminderSyncs: [overdueTask.id],
      };
      recoveryService.rescheduleOverdueTasks.mockResolvedValue(partialResponse);

      const result = await controller.rescheduleOverdueTasks(mockUser, validDto);

      expect(result.reminderSyncStatus).toBe('partial');
      expect(result.failedReminderSyncs).toContain(overdueTask.id);
    });

    it('пробрасывает ForbiddenException при попытке изменить чужую задачу (HTTP 403)', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(
        controller.rescheduleOverdueTasks(mockUser, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('пробрасывает ConflictException при stale state (HTTP 409)', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new ConflictException({
          message: 'Some tasks are no longer overdue',
          code: 'STALE_RECOVERY_STATE',
          staleTaskIds: [overdueTask.id],
        }),
      );

      await expect(
        controller.rescheduleOverdueTasks(mockUser, validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('пробрасывает UnprocessableEntityException при пустом items (HTTP 422)', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new UnprocessableEntityException('items array cannot be empty'),
      );

      const emptyDto = { items: [] } as any;

      await expect(
        controller.rescheduleOverdueTasks(mockUser, emptyDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('принимает null targetStartTime как Inbox destination', async () => {
      const inboxDto = {
        items: [{ taskId: overdueTask.id, targetStartTime: null }],
      } as any;
      const inboxResponse = {
        updatedCount: 1,
        taskUpdateStatus: 'ok' as const,
        reminderSyncStatus: 'ok' as const,
      };
      recoveryService.rescheduleOverdueTasks.mockResolvedValue(inboxResponse);

      const result = await controller.rescheduleOverdueTasks(mockUser, inboxDto);

      expect(recoveryService.rescheduleOverdueTasks).toHaveBeenCalledWith(
        mockUser.id,
        inboxDto.items,
      );
      expect(result.updatedCount).toBe(1);
    });

    it('принимает mixed batch (одни в будущее, другие в Inbox)', async () => {
      const anotherTaskId = 'task-overdue-ctrl-2';
      const mixedDto = {
        items: [
          { taskId: overdueTask.id, targetStartTime: futureTime },
          { taskId: anotherTaskId, targetStartTime: null },
        ],
      } as any;
      const mixedResponse = {
        updatedCount: 2,
        taskUpdateStatus: 'ok' as const,
        reminderSyncStatus: 'ok' as const,
      };
      recoveryService.rescheduleOverdueTasks.mockResolvedValue(mixedResponse);

      const result = await controller.rescheduleOverdueTasks(mockUser, mixedDto);

      expect(result.updatedCount).toBe(2);
      expect(recoveryService.rescheduleOverdueTasks).toHaveBeenCalledWith(
        mockUser.id,
        mixedDto.items,
      );
    });

    it('не передаёт userId из тела запроса — только из @CurrentUser()', async () => {
      recoveryService.rescheduleOverdueTasks.mockResolvedValue(successResponse);

      await controller.rescheduleOverdueTasks(mockUser, validDto);

      const callArgs = recoveryService.rescheduleOverdueTasks.mock.calls[0];
      expect(callArgs[0]).toBe(mockUser.id);
    });
  });
});
