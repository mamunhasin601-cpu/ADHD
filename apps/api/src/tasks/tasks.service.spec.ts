import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// Минимальный mock PrismaService для unit-тестов
const mockPrisma = {
  task: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('создаёт задачу с дефолтными значениями', async () => {
      const userId = 'user-uuid-1';
      const dto = { title: 'Почитать 30 минут' };
      const created = { id: 'task-1', userId, title: dto.title, color: '#6B5BFC', durationMinutes: 30 };

      mockPrisma.task.create.mockResolvedValue(created);

      const result = await service.create(userId, dto);
      expect(result).toEqual(created);
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, title: dto.title }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('бросает NotFoundException если задача не найдена', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'nonexistent-id'))
        .rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если задача принадлежит другому пользователю', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        userId: 'other-user',
        subTasks: [],
      });

      await expect(service.findOne('user-1', 'task-1'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('toggleComplete', () => {
    it('устанавливает completedAt если задача не завершена', async () => {
      const task = { id: 'task-1', userId: 'user-1', completedAt: null, subTasks: [] };
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.task.update.mockResolvedValue({ ...task, completedAt: new Date() });

      const result = await service.toggleComplete('user-1', 'task-1');
      expect(result.completedAt).not.toBeNull();
    });

    it('сбрасывает completedAt если задача уже завершена', async () => {
      const task = { id: 'task-1', userId: 'user-1', completedAt: new Date(), subTasks: [] };
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.task.update.mockResolvedValue({ ...task, completedAt: null });

      const result = await service.toggleComplete('user-1', 'task-1');
      expect(result.completedAt).toBeNull();
    });
  });

  describe('findAll с фильтром по дате', () => {
    it('передаёт правильный диапазон дат в where при указании date', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.findAll('user-1', { date: '2026-07-23' });

      const callArg = mockPrisma.task.findMany.mock.calls[0][0];
      expect(callArg.where.startTime).toBeDefined();
      expect(callArg.where.startTime.gte).toBeInstanceOf(Date);
      expect(callArg.where.startTime.lte).toBeInstanceOf(Date);
    });
  });
});
