import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanService } from '../plan/plan.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import type { Task } from '@prisma/client';
import { formatInTimeZone, fromZonedTime, toDate } from 'date-fns-tz';

const SUPPORTED_RULES = ['FREQ=DAILY', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'] as const;
const RECURRENCE_HORIZON_DAYS = 60;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly planService: PlanService,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    this.assertRecurrence(dto.isRecurring, dto.recurrenceRule, dto.startTime, dto.parentTaskId);
    // Проверяем лимит задач для Free пользователей
    if (!dto.parentTaskId) {
      await this.planService.enforceTaskLimit(userId);
    }

    const timezone = dto.isRecurring ? await this.profileTimezone(userId) : null;
    const start = dto.startTime ? new Date(dto.startTime) : null;
    const anchorKey = start && timezone ? formatInTimeZone(start, timezone, 'yyyy-MM-dd') : null;
    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        firstStep: dto.firstStep ?? null,
        startTime: start,
        durationMinutes: dto.durationMinutes ?? null,
        color: dto.color ?? '#6B5BFC',
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule ?? null,
        recurrenceTimezone: timezone,
        recurrenceDateKey: anchorKey,
        parentTaskId: dto.parentTaskId ?? null,
      },
      include: { subTasks: true },
    });

    if (task.isRecurring) await this.extendSeries(userId, task.id);
    else await this.syncReminder(task);
    return task;
  }

  async findAll(userId: string, query: GetTasksQueryDto): Promise<Task[]> {
    const where: Record<string, unknown> = {
      userId,
      parentTaskId: null, // только верхнеуровневые задачи
      isRecurring: false, // series templates are not actionable; occurrences are
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
    const selected = await this.findOne(userId, taskId);
    const effectiveId = selected.seriesId ?? selected.id;
    const existing = selected.seriesId ? await this.findOne(userId, selected.seriesId) : selected;
    this.assertRecurrence(dto.isRecurring ?? existing.isRecurring, dto.recurrenceRule === undefined ? existing.recurrenceRule : dto.recurrenceRule, dto.startTime === undefined ? existing.startTime?.toISOString() : dto.startTime, existing.parentTaskId, selected.seriesId);
    if (existing.isRecurring) await this.cancelAndDeleteOccurrences(existing.id);

    const task = await this.prisma.task.update({
      where: { id: effectiveId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
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
    if (task.isRecurring) {
      const timezone = await this.profileTimezone(userId);
      const start = task.startTime!;
      await this.prisma.task.update({ where: { id: task.id }, data: {
        recurrenceTimezone: timezone,
        recurrenceDateKey: formatInTimeZone(start, timezone, 'yyyy-MM-dd'),
        recurrenceGeneratedThrough: null,
      }});
      await this.extendSeries(userId, task.id);
    } else await this.syncReminder(task);
    return task;
  }

  async remove(userId: string, taskId: string): Promise<void> {
    const selected = await this.findOne(userId, taskId);
    const effectiveId = selected.seriesId ?? selected.id;
    const series = selected.seriesId ? await this.findOne(userId, selected.seriesId) : selected;
    if (series.isRecurring) await this.cancelAndDeleteOccurrences(series.id);
    await this.prisma.task.delete({ where: { id: effectiveId } });
    await this.safeCancelReminder(effectiveId);
  }

  /** Atomically records the first explicit start; concurrent retries cannot replace it. */
  async start(userId: string, taskId: string): Promise<Task> {
    const existing = await this.findOne(userId, taskId);
    if (existing.isRecurring) throw new BadRequestException('Начните конкретную задачу повтора');
    if (existing.completedAt) {
      throw new ConflictException('Завершённую задачу нельзя начать');
    }

    await this.prisma.task.updateMany({
      where: { id: taskId, userId, startedAt: null, completedAt: null },
      data: { startedAt: new Date() },
    });
    const task = await this.findOne(userId, taskId);
    if (task.completedAt && !task.startedAt) {
      throw new ConflictException('Завершённую задачу нельзя начать');
    }
    await this.safeCancelReminder(taskId);
    return task;
  }

  /** Отметить задачу как выполненную / невыполненную */
  async toggleComplete(userId: string, taskId: string): Promise<Task> {
    const task = await this.findOne(userId, taskId);
    if (task.isRecurring) throw new BadRequestException('Завершите конкретную задачу повтора');

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
      if (task.completedAt || task.startedAt || !task.startTime) {
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

  /** Explicit, idempotent lifecycle extension. GET never materializes rows. */
  async extendSeries(userId: string, seriesId: string, horizonStart?: string): Promise<number> {
    const series = await this.findOne(userId, seriesId);
    if (!series.isRecurring || !series.startTime || !series.recurrenceRule) return 0;
    if (!SUPPORTED_RULES.includes(series.recurrenceRule as typeof SUPPORTED_RULES[number])) {
      throw new BadRequestException('Неподдерживаемое правило повторения');
    }
    const timezone = series.recurrenceTimezone || await this.profileTimezone(userId);
    const anchor = series.recurrenceDateKey || formatInTimeZone(series.startTime, timezone, 'yyyy-MM-dd');
    const wall = formatInTimeZone(series.startTime, timezone, 'HH:mm:ss');
    const keys: string[] = [];
    const requestedStart = horizonStart && horizonStart > anchor ? horizonStart : anchor;
    const cursor = new Date(`${requestedStart}T12:00:00Z`);
    for (let i = 0; i <= RECURRENCE_HORIZON_DAYS; i++) {
      const key = cursor.toISOString().slice(0, 10);
      const weekday = cursor.getUTCDay();
      if (series.recurrenceRule === 'FREQ=DAILY' || (weekday >= 1 && weekday <= 5)) keys.push(key);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const result = await this.prisma.task.createMany({ data: keys.map((key) => ({
      userId, title: series.title, firstStep: series.firstStep, durationMinutes: series.durationMinutes,
      color: series.color, startTime: fromZonedTime(`${key}T${wall}`, timezone), seriesId: series.id,
      recurrenceDateKey: key, isRecurring: false, recurrenceRule: series.recurrenceRule,
    })), skipDuplicates: true });
    const through = keys[keys.length - 1] ?? anchor;
    await this.prisma.task.update({ where: { id: series.id }, data: { recurrenceTimezone: timezone, recurrenceDateKey: anchor, recurrenceGeneratedThrough: through } });
    const occurrences = await this.prisma.task.findMany({ where: { seriesId: series.id, recurrenceDateKey: { in: keys } } });
    await Promise.all(occurrences.map((occurrence) => this.syncReminder(occurrence)));
    return result.count;
  }

  async extendAllSeries(userId: string, horizonStart: string): Promise<number> {
    const rows = await this.prisma.task.findMany({ where: { userId, isRecurring: true, seriesId: null }, select: { id: true } });
    const counts = await Promise.all(rows.map(({ id }) => this.extendSeries(userId, id, horizonStart)));
    return counts.reduce((sum, count) => sum + count, 0);
  }

  private assertRecurrence(isRecurring?: boolean, rule?: string | null, startTime?: string | null, parentTaskId?: string | null, occurrenceSeriesId?: string | null): void {
    if (!isRecurring && rule && !occurrenceSeriesId) throw new BadRequestException('recurrenceRule требует isRecurring=true');
    if (isRecurring && (!rule || !SUPPORTED_RULES.includes(rule as typeof SUPPORTED_RULES[number]))) throw new BadRequestException('Выберите поддерживаемый тип повтора');
    if (isRecurring && !startTime) throw new BadRequestException('Повторяющейся задаче нужны дата и время');
    if (isRecurring && parentTaskId) throw new BadRequestException('Подзадача не может быть серией');
  }

  private async profileTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timezone = user?.timezone;
    if (!timezone) throw new BadRequestException('Для повтора требуется часовой пояс профиля');
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw new BadRequestException('Часовой пояс профиля недействителен; обновите его с устройства'); }
    return timezone;
  }

  private async cancelAndDeleteOccurrences(seriesId: string): Promise<void> {
    const occurrences = await this.prisma.task.findMany({ where: { seriesId }, select: { id: true } });
    await Promise.all(occurrences.map(({ id }) => this.safeCancelReminder(id)));
    await this.prisma.task.deleteMany({ where: { seriesId } });
  }
}
