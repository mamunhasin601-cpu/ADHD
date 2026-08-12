import supertest = require('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Реальные HTTP тесты для GET /tasks?inbox=true.
 *
 * Запросы проходят полный Nest HTTP-пайплайн:
 * Express routing → JwtAuthGuard (override) → ValidationPipe → Controller → мок-сервис.
 *
 * Доказывают:
 * - query-string → DTO трансформацию и валидацию (inbox=true, inbox=invalid, userId=...)
 * - корректную передачу identity из @CurrentUser() в сервис
 * - HTTP response status и body
 * - проброс ошибок сервиса
 */
describe('GET /tasks — Inbox HTTP boundary', () => {
  let app: INestApplication;
  let tasksService: jest.Mocked<Pick<TasksService, 'findAll'>>;

  const mockUser = { id: 'user-http-inbox-1', email: 'http@inbox.test', timezone: 'UTC' };

  const inboxTask = {
    id: 'task-http-1',
    userId: mockUser.id,
    title: 'HTTP Inbox Task',
    startTime: null,
    completedAt: null,
    isRecurring: false,
    parentTaskId: null,
    durationMinutes: 30,
    color: '#6B5BFC',
    subTasks: [],
  };

  beforeAll(async () => {
    const mockTasksService = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([inboxTask]),
      findOne: jest.fn(),
      update: jest.fn(),
      toggleComplete: jest.fn(),
      remove: jest.fn(),
    };

    const mockRecoveryService = {
      getOverdueTasks: jest.fn(),
      rescheduleOverdueTasks: jest.fn(),
    };

    // Override guard: устанавливает request.user = mockUser, не требует JWT
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

    // Применяем ту же ValidationPipe что и в production (см. main.ts)
    // Та же конфигурация что в production main.ts (без enableImplicitConversion)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    tasksService = module.get(TasksService) as any;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (tasksService.findAll as jest.Mock).mockResolvedValue([inboxTask]);
  });

  // ── Успешные запросы ──────────────────────────────────────

  it('GET /tasks?inbox=true → 200 и делегирует с inbox: true и userId из @CurrentUser', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=true')
      .expect(200);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ inbox: true }),
    );
  });

  it('GET /tasks?inbox=true → body содержит результат сервиса', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/tasks?inbox=true')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(inboxTask.id);
  });

  it('GET /tasks?inbox=true&includeSubTasks=true → оба параметра конвертированы корректно', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=true&includeSubTasks=true')
      .expect(200);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ inbox: true, includeSubTasks: true }),
    );
  });

  it('GET /tasks?inbox=false → inbox: false, сервис вызван без inbox=true', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=false')
      .expect(200);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ inbox: false }),
    );
  });

  it('GET /tasks (без inbox) → 200, inbox не передаётся как true', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks')
      .expect(200);

    const callArg = (tasksService.findAll as jest.Mock).mock.calls[0][1];
    expect(callArg.inbox).toBeUndefined();
  });

  it('userId приходит из @CurrentUser(), не из query-string identity', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=true')
      .expect(200);

    const calledUserId = (tasksService.findAll as jest.Mock).mock.calls[0][0];
    expect(calledUserId).toBe(mockUser.id);
  });

  // ── Валидация: отклонение невалидных значений ─────────────

  it('GET /tasks?inbox=invalid → 400 Bad Request (невалидный boolean)', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=invalid')
      .expect(400);

    expect(tasksService.findAll).not.toHaveBeenCalled();
  });

  it('GET /tasks?inbox=1 → 400 Bad Request (число не является строгим boolean)', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=1')
      .expect(400);

    expect(tasksService.findAll).not.toHaveBeenCalled();
  });

  it('GET /tasks?inbox=true&userId=attacker → 400 (forbidNonWhitelisted отклоняет userId)', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?inbox=true&userId=attacker-id')
      .expect(400);

    expect(tasksService.findAll).not.toHaveBeenCalled();
  });

  // ── scheduledFrom / scheduledTo — bounded bootstrap projection (0011B) ──

  it('GET /tasks?scheduledFrom=...&scheduledTo=... → 200, params forwarded to service', async () => {
    const from = '2026-08-05T00:00:00.000Z';
    const to = '2026-08-12T23:59:59.999Z';

    await supertest(app.getHttpServer())
      .get(`/tasks?scheduledFrom=${encodeURIComponent(from)}&scheduledTo=${encodeURIComponent(to)}`)
      .expect(200);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ scheduledFrom: from, scheduledTo: to }),
    );
  });

  it('GET /tasks?scheduledFrom=... (no scheduledTo) → 200, service receives only scheduledFrom', async () => {
    const from = '2026-08-05T00:00:00.000Z';

    await supertest(app.getHttpServer())
      .get(`/tasks?scheduledFrom=${encodeURIComponent(from)}`)
      .expect(200);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ scheduledFrom: from }),
    );
  });

  it('GET /tasks?scheduledFrom=not-an-instant → 400 (invalid ISO 8601 instant)', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?scheduledFrom=not-a-date')
      .expect(400);

    expect(tasksService.findAll).not.toHaveBeenCalled();
  });

  it('GET /tasks?scheduledTo=not-an-instant → 400 (invalid ISO 8601 instant)', async () => {
    await supertest(app.getHttpServer())
      .get('/tasks?scheduledTo=bad-value')
      .expect(400);

    expect(tasksService.findAll).not.toHaveBeenCalled();
  });

  // ── Проброс ошибок сервиса ────────────────────────────────

  it('ошибка сервиса → 500 Internal Server Error', async () => {
    (tasksService.findAll as jest.Mock).mockRejectedValue(new Error('DB unavailable'));

    await supertest(app.getHttpServer())
      .get('/tasks?inbox=true')
      .expect(500);
  });
});
