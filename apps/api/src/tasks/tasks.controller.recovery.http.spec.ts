import supertest = require('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import {
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FREE_TIER_LIMITS } from '@focus/shared-types';

/**
 * Реальные HTTP тесты для recovery-маршрутов (Task 0007).
 *
 * Запросы проходят полный Nest HTTP-пайплайн:
 * Express routing → JwtAuthGuard (override) → ValidationPipe → Controller → мок-сервис.
 *
 * Закрывают пробел, выявленный при приёмке 0007: до этого все ограничения
 * RescheduleRecoveryDto (IsDefined / IsUUID / IsISO8601 / ArrayNotEmpty /
 * ArrayMaxSize) проверялись только изолированно через plainToInstance, а
 * маппинг 403/409/422 — только по типу исключения от мока. Ни один тест не
 * доказывал реальные HTTP-статусы и работу production ValidationPipe на этих
 * маршрутах.
 */
describe('Recovery HTTP boundary — GET /tasks/recovery, POST /tasks/recovery/reschedule', () => {
  let app: INestApplication;
  let recoveryService: {
    getOverdueTasks: jest.Mock;
    rescheduleOverdueTasks: jest.Mock;
  };

  const mockUser = {
    id: 'user-http-recovery-1',
    email: 'http@recovery.test',
    timezone: 'Europe/Moscow',
  };

  const VALID_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
  const VALID_UUID_2 = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';

  const okResponse = {
    updatedCount: 1,
    taskUpdateStatus: 'ok' as const,
    reminderSyncStatus: 'ok' as const,
  };

  beforeAll(async () => {
    const mockTasksService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      toggleComplete: jest.fn(),
      remove: jest.fn(),
    };

    const mockRecoveryService = {
      getOverdueTasks: jest.fn(),
      rescheduleOverdueTasks: jest.fn(),
    };

    const testGuard = {
      canActivate: (ctx: ExecutionContext) => {
        ctx.switchToHttp().getRequest().user = mockUser;
        return true;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: mockTasksService },
        { provide: TaskRecoveryService, useValue: mockRecoveryService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(testGuard)
      .compile();

    app = module.createNestApplication();

    // Та же конфигурация ValidationPipe что в production main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    recoveryService = module.get(TaskRecoveryService) as any;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    recoveryService.getOverdueTasks.mockResolvedValue({
      tasks: [],
      userTimezone: mockUser.timezone,
      localDayStart: '2026-08-04T21:00:00.000Z',
    });
    recoveryService.rescheduleOverdueTasks.mockResolvedValue(okResponse);
  });

  // ── GET /tasks/recovery ───────────────────────────────────────────────────

  describe('GET /tasks/recovery', () => {
    it('→ 200 и делегирует с userId из @CurrentUser()', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/tasks/recovery')
        .expect(200);

      expect(recoveryService.getOverdueTasks).toHaveBeenCalledTimes(1);
      expect(recoveryService.getOverdueTasks.mock.calls[0][0]).toBe(mockUser.id);
      expect(res.body.userTimezone).toBe(mockUser.timezone);
    });

    it('маршрут НЕ перехватывается GET /tasks/:id (ADR-008 D-9)', async () => {
      // Если бы recovery регистрировался после /tasks/:id, сюда бы пришёл
      // findOne с id="recovery" и ParseUUIDPipe вернул бы 400.
      await supertest(app.getHttpServer()).get('/tasks/recovery').expect(200);

      expect(recoveryService.getOverdueTasks).toHaveBeenCalled();
    });

    it('?date=YYYY-MM-DD принимается ValidationPipe', async () => {
      await supertest(app.getHttpServer())
        .get('/tasks/recovery?date=2026-08-05')
        .expect(200);
    });

    it('?userId=attacker → 400 (forbidNonWhitelisted)', async () => {
      await supertest(app.getHttpServer())
        .get('/tasks/recovery?userId=attacker-id')
        .expect(400);

      expect(recoveryService.getOverdueTasks).not.toHaveBeenCalled();
    });

    it('server owns day boundary: referenceInstant не приходит от клиента', async () => {
      // Контракт ADR-008 D-2: сервер сам определяет начало локального дня по
      // сохранённому user.timezone. Клиентский ?date используется только для
      // cache-key на мобильном клиенте и намеренно НЕ управляет вычислением.
      await supertest(app.getHttpServer())
        .get('/tasks/recovery?date=1999-01-01')
        .expect(200);

      expect(recoveryService.getOverdueTasks.mock.calls[0].length).toBe(1);
    });
  });

  // ── POST /tasks/recovery/reschedule — success ─────────────────────────────

  describe('POST /tasks/recovery/reschedule — принимаемые запросы', () => {
    it('явный null → 200 (Inbox destination)', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: VALID_UUID, targetStartTime: null }] })
        .expect(200);

      expect(res.body.taskUpdateStatus).toBe('ok');
      const items = recoveryService.rescheduleOverdueTasks.mock.calls[0][1];
      expect(items).toEqual([{ taskId: VALID_UUID, targetStartTime: null }]);
    });

    it('валидный ISO-8601 → 200', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({
          items: [{ taskId: VALID_UUID, targetStartTime: '2026-08-06T10:00:00.000Z' }],
        })
        .expect(200);

      expect(recoveryService.rescheduleOverdueTasks).toHaveBeenCalledTimes(1);
    });

    it('mixed batch (ISO + null) → 200, порядок сохранён', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({
          items: [
            { taskId: VALID_UUID, targetStartTime: '2026-08-06T10:00:00.000Z' },
            { taskId: VALID_UUID_2, targetStartTime: null },
          ],
        })
        .expect(200);

      const items = recoveryService.rescheduleOverdueTasks.mock.calls[0][1];
      expect(items).toHaveLength(2);
      expect(items[0].targetStartTime).toBe('2026-08-06T10:00:00.000Z');
      expect(items[1].targetStartTime).toBeNull();
    });

    it('userId берётся из @CurrentUser(), а не из тела запроса', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: VALID_UUID, targetStartTime: null }] })
        .expect(200);

      expect(recoveryService.rescheduleOverdueTasks.mock.calls[0][0]).toBe(mockUser.id);
    });

    it('reminderSyncStatus: partial отдаётся как 200 с телом partial', async () => {
      recoveryService.rescheduleOverdueTasks.mockResolvedValue({
        updatedCount: 1,
        taskUpdateStatus: 'ok',
        reminderSyncStatus: 'partial',
        failedReminderSyncs: [VALID_UUID],
      });

      const res = await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: VALID_UUID, targetStartTime: null }] })
        .expect(200);

      // Частичный сбой reminder-ов НЕ является HTTP-ошибкой: task update закоммичен.
      expect(res.body.taskUpdateStatus).toBe('ok');
      expect(res.body.reminderSyncStatus).toBe('partial');
      expect(res.body.failedReminderSyncs).toEqual([VALID_UUID]);
    });

    it(`граница ArrayMaxSize: ровно ${FREE_TIER_LIMITS.maxActiveTasks} items проходит валидацию`, async () => {
      const items = Array.from({ length: FREE_TIER_LIMITS.maxActiveTasks }, (_, i) => ({
        taskId: `3f2504e0-4f89-11d3-9a0c-${String(100000000000 + i).slice(0, 12)}`,
        targetStartTime: null,
      }));

      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items })
        .expect(200);

      expect(recoveryService.rescheduleOverdueTasks).toHaveBeenCalled();
    });
  });

  // ── POST — валидация отклоняет до вызова сервиса ──────────────────────────

  describe('POST /tasks/recovery/reschedule — отклоняемые запросы (no partial write)', () => {
    it('targetStartTime отсутствует (ключа нет) → 400, сервис не вызван', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: VALID_UUID }] })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('пустой items → 400 (ArrayNotEmpty), сервис не вызван', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [] })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it(`oversized batch (${FREE_TIER_LIMITS.maxActiveTasks + 1} items) → 400 (ArrayMaxSize)`, async () => {
      const items = Array.from(
        { length: FREE_TIER_LIMITS.maxActiveTasks + 1 },
        () => ({ taskId: VALID_UUID, targetStartTime: null }),
      );

      const res = await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('cannot exceed');
      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('items отсутствует полностью → 400', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({})
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('невалидный UUID в taskId → 400', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: 'not-a-uuid', targetStartTime: null }] })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('malformed (не ISO) targetStartTime → 400', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: VALID_UUID, targetStartTime: 'завтра утром' }] })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('пустая строка в targetStartTime → 400 (не трактуется как Inbox)', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({ items: [{ taskId: VALID_UUID, targetStartTime: '' }] })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('userId в теле запроса → 400 (forbidNonWhitelisted)', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({
          userId: 'attacker-id',
          items: [{ taskId: VALID_UUID, targetStartTime: null }],
        })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('лишнее поле внутри item → 400 (forbidNonWhitelisted, nested)', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({
          items: [
            { taskId: VALID_UUID, targetStartTime: null, userId: 'attacker-id' },
          ],
        })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });

    it('один невалидный item отклоняет весь batch (атомарность на уровне валидации)', async () => {
      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send({
          items: [
            { taskId: VALID_UUID, targetStartTime: null },
            { taskId: 'not-a-uuid', targetStartTime: null },
          ],
        })
        .expect(400);

      expect(recoveryService.rescheduleOverdueTasks).not.toHaveBeenCalled();
    });
  });

  // ── POST — маппинг исключений сервиса в HTTP-статусы ──────────────────────

  describe('POST /tasks/recovery/reschedule — HTTP-статусы ошибок сервиса', () => {
    const validBody = { items: [{ taskId: VALID_UUID, targetStartTime: null }] };

    it('ForbiddenException (чужая задача) → 403', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new ForbiddenException('Access denied to tasks: x'),
      );

      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send(validBody)
        .expect(403);
    });

    it('ConflictException (stale state) → 409 с code STALE_RECOVERY_STATE', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new ConflictException({
          message: 'Some tasks are no longer overdue',
          code: 'STALE_RECOVERY_STATE',
          staleTaskIds: [VALID_UUID],
        }),
      );

      const res = await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send(validBody)
        .expect(409);

      expect(res.body.code).toBe('STALE_RECOVERY_STATE');
      expect(res.body.staleTaskIds).toEqual([VALID_UUID]);
    });

    it('UnprocessableEntityException (destination в прошлом) → 422', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new UnprocessableEntityException('targetStartTime is in the past'),
      );

      await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send(validBody)
        .expect(422);
    });

    it('неожидаемая ошибка → 500, детали не протекают в тело', async () => {
      recoveryService.rescheduleOverdueTasks.mockRejectedValue(
        new Error('connect ECONNREFUSED 10.0.0.5:5432'),
      );

      const res = await supertest(app.getHttpServer())
        .post('/tasks/recovery/reschedule')
        .send(validBody)
        .expect(500);

      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    });
  });
});
