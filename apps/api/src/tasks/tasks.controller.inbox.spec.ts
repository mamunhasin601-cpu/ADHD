import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';

/**
 * Контроллер unit-тест для Inbox-маршрута.
 *
 * Вызывает методы контроллера напрямую с уже построенными объектами.
 * НЕ доказывает query-string трансформацию, ValidationPipe или routing —
 * это покрывает tasks.controller.inbox.http.spec.ts.
 *
 * Доказывает:
 * - делегирование inbox: true в TasksService.findAll
 * - authenticated userId из @CurrentUser() передаётся в сервис
 * - response содержит только результат сервиса
 * - ошибки сервиса пробрасываются
 */
describe('TasksController — Inbox (unit)', () => {
  let controller: TasksController;
  let tasksService: jest.Mocked<TasksService>;

  const mockUser = {
    id: 'user-inbox-ctrl-1',
    email: 'inbox@test.local',
    timezone: 'Europe/Moscow',
  } as any;

  const inboxTask = {
    id: 'task-inbox-ctrl-1',
    userId: mockUser.id,
    title: 'Задача Inbox',
    startTime: null,
    completedAt: null,
    isRecurring: false,
    parentTaskId: null,
    durationMinutes: 30,
    color: '#6B5BFC',
    subTasks: [],
  } as any;

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
    tasksService = module.get(TasksService) as jest.Mocked<TasksService>;
  });

  // ── Inbox query delegation ────────────────────────────────

  it('GET /tasks?inbox=true передаёт inbox: true в TasksService.findAll', async () => {
    tasksService.findAll.mockResolvedValue([inboxTask]);

    const query = { inbox: true } as any;
    await controller.findAll(mockUser, query);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ inbox: true }),
    );
  });

  it('передаёт authenticated userId из @CurrentUser(), не из query-string', async () => {
    tasksService.findAll.mockResolvedValue([inboxTask]);

    // Caller пытается передать чужой userId через query — это должно игнорироваться
    const queryWithFakeUserId = { inbox: true, userId: 'attacker-id' } as any;
    await controller.findAll(mockUser, queryWithFakeUserId);

    const callArgs = tasksService.findAll.mock.calls[0];
    // Первый аргумент — authenticated userId, всегда из @CurrentUser()
    expect(callArgs[0]).toBe(mockUser.id);
    expect(callArgs[0]).not.toBe('attacker-id');
  });

  it('response содержит только результат сервиса', async () => {
    tasksService.findAll.mockResolvedValue([inboxTask]);

    const result = await controller.findAll(mockUser, { inbox: true } as any);

    expect(result).toEqual([inboxTask]);
  });

  it('возвращает пустой массив если Inbox пуст', async () => {
    tasksService.findAll.mockResolvedValue([]);

    const result = await controller.findAll(mockUser, { inbox: true } as any);

    expect(result).toEqual([]);
  });

  it('inbox=false + date → НЕ передаёт inbox в сервис как true', async () => {
    tasksService.findAll.mockResolvedValue([]);

    const query = { date: '2026-08-04' } as any;
    await controller.findAll(mockUser, query);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.not.objectContaining({ inbox: true }),
    );
  });

  it('inbox=true + includeSubTasks=true → оба параметра переданы', async () => {
    tasksService.findAll.mockResolvedValue([inboxTask]);

    const query = { inbox: true, includeSubTasks: true } as any;
    await controller.findAll(mockUser, query);

    expect(tasksService.findAll).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ inbox: true, includeSubTasks: true }),
    );
  });

  it('ошибка сервиса пробрасывается без трансформации', async () => {
    tasksService.findAll.mockRejectedValue(new Error('DB unavailable'));

    await expect(
      controller.findAll(mockUser, { inbox: true } as any),
    ).rejects.toThrow('DB unavailable');
  });
});
