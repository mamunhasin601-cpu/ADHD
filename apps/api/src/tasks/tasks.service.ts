import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanService } from '../plan/plan.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import type { Task } from '@prisma/client';
import { toDate } from 'date-fns-tz';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly planService: PlanService,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    // Проверяем лимит задач для Free пользователей
    if (!dto.parentTaskId) {
      await this.planService.enforceTaskLimit(userId);
    }

    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        durationMinutes: dto.durationMinutes ?? null,
        color: dto.color ?? '#6B5BFC',
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule ?? null,
        parentTaskId: dto.parentTaskId ?? null,
      },
      include: { subTasks: true },
    });

    await this.syncReminder(task);
    return task;
  }

  async findAll(userId: string, query: GetTasksQueryDto): Promise<Task[]> {
    const where: Record<string, unknown> = {
      userId,
      parentTaskId: null, // только верхнеуровневые задачи
    };

    if (query.inbox) {
      // Inbox-режим: только задачи без startTime (unscheduled).
      // Параметр date и scheduledFrom/To игнорируются — Inbox не привязан к дню.
      where['startTime'] = null;
    } else if (query.scheduledFrom) {
      // Bounded range query (bootstrap reconciliation, ADR-009).
      // Maximum server-enforced horizon: 30 days from scheduledFrom.
      const from = new Date(query.scheduledFrom);
      const maxHorizonMs = 30 * 24 * 60 * 60 * 1000;
      let to: Date;
      if (query.scheduledTo) {
        const requested = new Date(query.scheduledTo);
        const maxAllowed = new Date(from.getTime() + maxHorizonMs);
        to = requested < maxAllowed ? requested : maxAllowed;
      } else {
        to = new Date(from.getTime() + maxHorizonMs);
      }
      where['startTime'] = { gte: from, lte: to };
    } else if (query.date) {
      // Фильтр по дате: задачи, которые начинаются в указанный день
      // Получаем timezone пользователя
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      const userTimezone = user?.timezone || 'UTC';

      // Строим даты начала и конца дня в timezone пользователя
      // toDate интерпретирует строку в указанной timezone и возвращает Date в UTC
      const dayStartUtc = toDate(`${query.date}T00:00:00`, { timeZone: userTimezone });
      const dayEndUtc = toDate(`${query.date}T23:59:59.999`, { timeZone: userTimezone });

      where['startTime'] = { gte: dayStartUtc, lte: dayEndUtc };
    }

    if (query.incomplete) {
      where['completedAt'] = null;
    }

    return this.prisma.task.findMany({
      where,
      include: query.includeSubTasks ? { subTasks: true } : undefined,
      orderBy: [
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findOne(userId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { subTasks: true },
    });

    if (!task) throw new NotFoundException('Задача не найдена');
    if (task.userId !== userId) throw new ForbiddenException('Нет доступа к этой задаче');

    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {
    await this.findOne(userId, taskId); // проверяем принадлежность

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.startTime !== undefined && {
          startTime: dto.startTime ? new Date(dto.startTime) : null,
        }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.isRecurring !== undefined && { isRecurring: dto.isRecurring }),
        ...(dto.recurrenceRule !== undefined && { recurrenceRule: dto.recurrenceRule }),
        ...(dto.completedAt !== undefined && {
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        }),
      },
      include: { subTasks: true },
    });

    await this.syncReminder(task);
    return task;
  }

  async remove(userId: string, taskId: string): Promise<void> {
    await this.findOne(userId, taskId); // проверяем принадлежность
    await this.prisma.task.delete({ where: { id: taskId } });
    await this.safeCancelReminder(taskId);
  }

  /** Отметить задачу как выполненную / невыполненную */
  async toggleComplete(userId: string, taskId: string): Promise<Task> {
    const task = await this.findOne(userId, taskId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        completedAt: task.completedAt ? null : new Date(),
      },
      include: { subTasks: true },
    });

    await this.syncReminder(updated);
    return updated;
  }

  /**
   * Единая точка синхронизации напоминания с текущим состоянием задачи:
   * выполненная задача или задача без startTime — напоминание отменяется,
   * иначе — (пере)планируется на актуальное startTime.
   *
   * ВАЖНО (ограничение): scheduleTaskReminder планирует ровно один пуш на конкретный
   * startTime. Для повторяющихся задач (isRecurring + recurrenceRule) это покрывает
   * только ближайшее вхождение — перепланирование следующих вхождений RRULE
   * требует отдельного механизма (например, суточной cron-job) и сюда не входит.
   *
   * Ошибки очереди не должны валить CRUD-операцию (например, Redis временно недоступен) —
   * задача в БД уже сохранена, поэтому здесь ошибки только логируются.
   */
  private async syncReminder(task: Task): Promise<void> {
    try {
      if (task.completedAt || !task.startTime) {
        await this.notifications.cancelTaskReminder(task.id);
      } else {
        await this.notifications.scheduleTaskReminder(task);
      }
    } catch (err) {
      this.logger.error(`Не удалось синхронизировать напоминание для задачи ${task.id}:`, err);
    }
  }

  private async safeCancelReminder(taskId: string): Promise<void> {
    try {
      await this.notifications.cancelTaskReminder(taskId);
    } catch (err) {
      this.logger.error(`Не удалось отменить напоминание для задачи ${taskId}:`, err);
    }
  }
}
