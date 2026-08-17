import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanService } from '../plan/plan.service';
import { CreateTaskDto, MAX_MANUAL_TASK_PARTS } from './dto/create-task.dto';
import { TaskPartWriteDto } from './dto/task-part-write.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import type { Prisma, Task } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
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

  async create(userId: string, dto: CreateTaskDto): Promise<Task & { newOccurrenceIds?: string[] }> {
    const hasParts = dto.subTasks !== undefined;
    if (hasParts) {
      this.validatePartDraft(dto.subTasks, 'create');
      if (dto.parentTaskId) throw new BadRequestException('Части можно добавить только к корневой задаче');
      if (dto.isRecurring) throw new BadRequestException('Части недоступны для повторяющихся задач');
    }
    this.assertRecurrence(dto.isRecurring, dto.recurrenceRule, dto.startTime, dto.parentTaskId);
    if (dto.parentTaskId) {
      const parent = await this.findOne(userId, dto.parentTaskId);
      if (parent.parentTaskId || parent.isRecurring || parent.seriesId) {
        throw new BadRequestException('Части доступны только для обычной корневой задачи');
      }
      this.assertLegacyPartWrite(dto);
    }
    const timezone = dto.isRecurring ? await this.profileTimezone(userId, dto.deviceTimezone) : null;
    const start = dto.startTime ? new Date(dto.startTime) : null;
    const anchorKey = start && timezone ? formatInTimeZone(start, timezone, 'yyyy-MM-dd') : null;
    const data: Prisma.TaskUncheckedCreateInput = {
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
    };

    if (!dto.parentTaskId && dto.createRequestId) {
      return this.createIdempotentRoot(userId, dto, data, timezone, anchorKey);
    }
    if (dto.parentTaskId && dto.createRequestId) {
      throw new BadRequestException('createRequestId доступен только для корневой задачи');
    }

    // Legacy clients keep the original behavior when no request identity is supplied.
    if (!dto.parentTaskId) await this.planService.enforceTaskLimit(userId);

    if (!dto.isRecurring && hasParts) {
      const task = await this.prisma.$transaction(async (tx) => {
        const parent = await tx.task.create({ data, include: { subTasks: true } });
        const parts = [] as Task[];
        for (const part of dto.subTasks!) {
          parts.push(await tx.task.create({
            data: this.partCreateData(userId, parent.id, part),
            include: { subTasks: true },
          }));
        }
        return { ...parent, subTasks: parts };
      });
      await this.syncReminder(task);
      return task;
    }

    if (!dto.isRecurring) {
      const task = await this.prisma.task.create({ data, include: { subTasks: true } });
      if (!dto.parentTaskId) await this.syncReminder(task);
      return task;
    }

    const { today, target } = this.horizon(timezone!);
    const result = await this.prisma.$transaction(async (tx) => {
      const template = await tx.task.create({
        data: { ...data, recurrenceGeneratedThrough: null },
        include: { subTasks: true },
      });
      const newOccurrenceIds = await this.insertProjection(
        tx, template, timezone!, anchorKey! > today ? anchorKey! : today, target,
      );
      const committedTemplate = await tx.task.update({
        where: { id: template.id },
        data: {
          recurrenceTimezone: timezone,
          recurrenceDateKey: anchorKey,
          recurrenceGeneratedThrough: target,
        },
        include: { subTasks: true },
      });
      return { template: committedTemplate, newOccurrenceIds };
    });

    const occurrences = await this.prisma.task.findMany({
      where: { id: { in: result.newOccurrenceIds } },
    });
    await Promise.all(occurrences.map((occurrence) => this.syncReminder(occurrence)));
    return { ...result.template, newOccurrenceIds: result.newOccurrenceIds };
  }

  private async createIdempotentRoot(
    userId: string,
    dto: CreateTaskDto,
    data: Prisma.TaskUncheckedCreateInput,
    timezone: string | null,
    anchorKey: string | null,
  ): Promise<Task & { newOccurrenceIds?: string[] }> {
    const requestId = dto.createRequestId!;
    const payloadHash = this.createPayloadHash(data, dto.subTasks);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const requestStore = tx.taskCreateRequest;
        await requestStore.create({ data: { userId, requestId, payloadHash } });
        await this.planService.enforceTaskLimit(userId, tx);

        if (dto.isRecurring) {
          const { today, target } = this.horizon(timezone!);
          const template = await tx.task.create({
            data: { ...data, recurrenceGeneratedThrough: null },
            include: { subTasks: true },
          });
          const newOccurrenceIds = await this.insertProjection(
            tx, template, timezone!, anchorKey! > today ? anchorKey! : today, target,
          );
          const committedTemplate = await tx.task.update({
            where: { id: template.id },
            data: {
              recurrenceTimezone: timezone,
              recurrenceDateKey: anchorKey,
              recurrenceGeneratedThrough: target,
            },
            include: { subTasks: true },
          });
          await requestStore.update({
            where: { userId_requestId: { userId, requestId } },
            data: { taskId: committedTemplate.id },
          });
          return { task: committedTemplate, newOccurrenceIds };
        }

        const parent = await tx.task.create({ data, include: { subTasks: true } });
        const parts: Task[] = [];
        for (const part of dto.subTasks ?? []) {
          parts.push(await tx.task.create({
            data: this.partCreateData(userId, parent.id, part),
            include: { subTasks: true },
          }));
        }
        const task = { ...parent, subTasks: parts };
        await requestStore.update({
          where: { userId_requestId: { userId, requestId } },
          data: { taskId: task.id },
        });
        return { task, newOccurrenceIds: undefined };
      });

      if (created.task.isRecurring) {
        const occurrences = await this.prisma.task.findMany({
          where: { id: { in: created.newOccurrenceIds ?? [] } },
        });
        await Promise.all(occurrences.map((occurrence) => this.syncReminder(occurrence)));
        return { ...created.task, newOccurrenceIds: created.newOccurrenceIds };
      }
      await this.syncReminder(created.task);
      return created.task;
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;

      const requestStore = this.prisma.taskCreateRequest;
      const claim = await requestStore.findUnique({
        where: { userId_requestId: { userId, requestId } },
      });
      if (!claim) throw error;
      if (claim.payloadHash !== payloadHash) {
        throw new ConflictException({
          message: 'createRequestId уже использован для другого содержимого задачи',
          code: 'TASK_CREATE_REQUEST_CONFLICT',
        });
      }
      if (!claim.taskId) {
        throw new ConflictException({
          message: 'Создание задачи с этим createRequestId ещё выполняется',
          code: 'TASK_CREATE_REQUEST_IN_PROGRESS',
        });
      }
      const canonical = await this.prisma.task.findUnique({
        where: { id: claim.taskId },
        include: { subTasks: true },
      });
      if (!canonical || canonical.userId !== userId) {
        throw new ConflictException({
          message: 'Не удалось восстановить результат создания задачи',
          code: 'TASK_CREATE_REQUEST_INVALID',
        });
      }
      return canonical;
    }
  }

  private createPayloadHash(
    data: Prisma.TaskUncheckedCreateInput,
    parts: TaskPartWriteDto[] | undefined,
  ): string {
    const normalized = {
      title: data.title,
      firstStep: data.firstStep ?? null,
      startTime: data.startTime instanceof Date ? data.startTime.toISOString() : data.startTime ?? null,
      durationMinutes: data.durationMinutes ?? null,
      color: data.color,
      isRecurring: data.isRecurring,
      recurrenceRule: data.recurrenceRule ?? null,
      recurrenceTimezone: data.recurrenceTimezone ?? null,
      recurrenceDateKey: data.recurrenceDateKey ?? null,
      parentTaskId: null,
      subTasks: (parts ?? []).map((part) => ({
        title: part.title.trim(),
        completed: part.completed ?? false,
      })),
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002';
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
      let userTimezone = user?.timezone;
      try {
        if (!userTimezone) throw new Error();
        new Intl.DateTimeFormat('en', { timeZone: userTimezone }).format();
      } catch {
        userTimezone = query.deviceTimezone;
      }
      if (!userTimezone) throw new BadRequestException('Нужен допустимый timezone профиля или устройства');

      // Строим даты начала и конца дня в timezone пользователя
      // toDate интерпретирует строку в указанной timezone и возвращает Date в UTC
      const dayStartUtc = toDate(`${query.date}T00:00:00`, { timeZone: userTimezone });
      const dayEndUtc = toDate(`${query.date}T23:59:59.999`, { timeZone: userTimezone });

      where['startTime'] = { gte: dayStartUtc, lte: dayEndUtc };
    }

    if (query.incomplete) {
      where['completedAt'] = null;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: { ...(query.includeSubTasks && { subTasks: true }), series: true },
      orderBy: [
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return tasks.map((task) => {
      const { series, ...row } = task;
      return {
        ...row,
        ...(series && {
          seriesStartTime: series.startTime,
          seriesTimezone: series.recurrenceTimezone,
          seriesRecurrenceRule: series.recurrenceRule,
        }),
      };
    });
  }

  async findOne(userId: string, taskId: string): Promise<Task & { subTasks: Task[] }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { subTasks: true },
    });

    if (!task) throw new NotFoundException('Задача не найдена');
    if (task.userId !== userId) throw new ForbiddenException('Нет доступа к этой задаче');

    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task & { affectedOccurrenceIds?: string[]; newOccurrenceIds?: string[] }> {
    const hasParts = dto.subTasks !== undefined;
    if (hasParts) this.validatePartDraft(dto.subTasks, 'update');
    const selected = await this.findOne(userId, taskId);
    const series = selected.seriesId ? await this.findOne(userId, selected.seriesId) : selected;

    if (hasParts && (series.isRecurring || !!selected.seriesId || !!selected.parentTaskId || dto.isRecurring === true)) {
      throw new BadRequestException('Части доступны только для обычной корневой задачи');
    }

    // Explicit non-recurring -> active-series transition.
    if (!series.isRecurring && dto.isRecurring === true) {
      const subTaskCount = await this.prisma.task.count({ where: { parentTaskId: series.id } });
      const transitionStart = dto.startTime !== undefined ? (dto.startTime ? new Date(dto.startTime) : null) : series.startTime;
      if (!transitionStart || series.parentTaskId || series.startedAt || series.completedAt || subTaskCount > 0) {
        throw new BadRequestException('Повтор можно включить только для незавершённой задачи со временем и без шагов');
      }
      this.assertRecurrence(true, dto.recurrenceRule, transitionStart.toISOString(), series.parentTaskId);
      const timezone = await this.profileTimezone(userId, dto.deviceTimezone);
      const anchor = formatInTimeZone(transitionStart, timezone, 'yyyy-MM-dd');
      const { today, target } = this.horizon(timezone);
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({ where: { id: series.id }, data: {
          ...(dto.title !== undefined && { title: dto.title }), ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
          ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }), ...(dto.color !== undefined && { color: dto.color }),
          startTime: transitionStart, isRecurring: true, recurrenceRule: dto.recurrenceRule, recurrenceTimezone: timezone,
          recurrenceDateKey: anchor, recurrenceGeneratedThrough: target, recurrenceEndedAt: null,
        }, include: { subTasks: true } });
        const newIds = await this.insertProjection(tx, updated, timezone, anchor > today ? anchor : today, target);
        return { updated, newIds };
      });
      await this.safeCancelReminder(series.id); // template must never own a reminder
      const created = await this.prisma.task.findMany({ where: { id: { in: result.newIds } } });
      await Promise.all(created.map((task) => this.syncReminder(task)));
      return { ...result.updated, affectedOccurrenceIds: [series.id], newOccurrenceIds: result.newIds };
    }

    if (!series.isRecurring && hasParts) {
      const task = await this.prisma.$transaction(async (tx) => {
        const current = await tx.task.findUnique({
          where: { id: selected.id },
          include: { subTasks: true },
        });
        if (!current) throw new NotFoundException('Задача не найдена');
        if (current.userId !== userId) throw new ForbiddenException('Нет доступа к этой задаче');
        if (current.parentTaskId || current.isRecurring || current.seriesId) {
          throw new BadRequestException('Части доступны только для обычной корневой задачи');
        }

        const existingById = new Map((current.subTasks ?? []).map((part) => [part.id, part]));
        const retained = [] as Task[];
        for (const part of dto.subTasks!) {
          if (!part.id) continue;
          const existing = existingById.get(part.id);
          if (!existing) {
            const referenced = await tx.task.findUnique({ where: { id: part.id } });
            if (referenced && referenced.userId !== userId) {
              throw new ForbiddenException('Нет доступа к этой части задачи');
            }
            throw new BadRequestException('Часть не принадлежит этой задаче');
          }
          if (existing.userId !== userId) throw new ForbiddenException('Нет доступа к этой части задачи');
          if (existing.parentTaskId !== current.id) throw new BadRequestException('Часть не принадлежит этой задаче');
        }

        const parent = await tx.task.update({
          where: { id: selected.id },
          data: {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
            ...(dto.startTime !== undefined && { startTime: dto.startTime ? new Date(dto.startTime) : null }),
            ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
            ...(dto.color !== undefined && { color: dto.color }),
            ...(dto.completedAt !== undefined && { completedAt: dto.completedAt ? new Date(dto.completedAt) : null }),
          },
          include: { subTasks: true },
        });

        const retainedIds = dto.subTasks!.flatMap((part) => part.id ? [part.id] : []);
        await tx.task.deleteMany({
          where: {
            parentTaskId: current.id,
            ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
          },
        });

        for (const part of dto.subTasks!) {
          if (part.id) {
            const existing = existingById.get(part.id)!;
            const completionChanged = part.completed !== undefined && part.completed !== !!existing.completedAt;
            retained.push(await tx.task.update({
              where: { id: part.id },
              data: {
                title: part.title.trim(),
                ...(completionChanged && { completedAt: part.completed ? new Date() : null }),
              },
              include: { subTasks: true },
            }));
          } else {
            retained.push(await tx.task.create({
              data: this.partCreateData(userId, current.id, part),
              include: { subTasks: true },
            }));
          }
        }
        return { ...parent, subTasks: retained };
      });
      await this.syncReminder(task);
      return task;
    }

    if (!series.isRecurring) {
      if (selected.parentTaskId) this.assertLegacyPartWrite(dto);
      const task = await this.prisma.task.update({ where: { id: selected.id }, data: {
        ...(dto.title !== undefined && { title: dto.title }), ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime ? new Date(dto.startTime) : null }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }), ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.completedAt !== undefined && { completedAt: dto.completedAt ? new Date(dto.completedAt) : null }),
      }, include: { subTasks: true } });
      if (!selected.parentTaskId) await this.syncReminder(task);
      return task;
    }
    if (series.recurrenceEndedAt) throw new BadRequestException('Этот повтор уже остановлен');

    const timezone = await this.resolveSeriesTimezone(series, userId, dto.deviceTimezone);
    const { today, target } = this.horizon(timezone);
    const stop = dto.editRecurrencePattern === true && (dto.isRecurring === false || dto.recurrenceRule == null);
    const scheduleChanged = !stop && (dto.editRecurrenceAnchor === true || dto.editRecurrencePattern === true);
    const nextStart = dto.editRecurrenceAnchor && dto.startTime ? new Date(dto.startTime) : series.startTime!;
    const nextRule = dto.editRecurrencePattern ? dto.recurrenceRule : series.recurrenceRule;
    if (!stop) this.assertRecurrence(true, nextRule, nextStart.toISOString(), series.parentTaskId);
    const content = { ...(dto.title !== undefined && { title: dto.title }), ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
      ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }), ...(dto.color !== undefined && { color: dto.color }) };

    const result = await this.prisma.$transaction(async (tx) => {
      const futureWhere = { seriesId: series.id, recurrenceDateKey: { gt: stop ? today : this.addDateKey(today, -1) }, startedAt: null, completedAt: null };
      const removed = (stop || scheduleChanged) ? await tx.task.findMany({ where: futureWhere, select: { id: true } }) : [];
      const nextAnchor = dto.editRecurrenceAnchor ? formatInTimeZone(nextStart, timezone, 'yyyy-MM-dd')
        : (series.recurrenceDateKey || formatInTimeZone(series.startTime!, timezone, 'yyyy-MM-dd'));
      const updated = await tx.task.update({ where: { id: series.id }, data: {
        ...content, ...(dto.editRecurrenceAnchor && { startTime: nextStart, recurrenceDateKey: nextAnchor }),
        ...(dto.editRecurrencePattern && !stop && { recurrenceRule: nextRule }),
        ...(stop && { recurrenceEndedAt: new Date(), recurrenceGeneratedThrough: today }),
        ...(scheduleChanged && { recurrenceGeneratedThrough: target }),
      }, include: { subTasks: true } });
      if (stop || scheduleChanged) await tx.task.deleteMany({ where: futureWhere });
      else if (Object.keys(content).length) await tx.task.updateMany({ where: { seriesId: series.id, recurrenceDateKey: { gte: today }, startedAt: null, completedAt: null }, data: content });
      const newIds = scheduleChanged
        ? await this.insertProjection(tx, { ...updated, startTime: nextStart, recurrenceRule: nextRule } as Task, timezone, nextAnchor > today ? nextAnchor : today, target)
        : [];
      return { updated, removedIds: removed.map(({ id }) => id), newIds };
    });
    await Promise.all(result.removedIds.map((id) => this.safeCancelReminder(id)));
    const changedIds = scheduleChanged ? result.newIds : (await this.prisma.task.findMany({ where: { seriesId: series.id, recurrenceDateKey: { gte: today }, startedAt: null, completedAt: null }, select: { id: true } })).map(({ id }) => id);
    const changed = await this.prisma.task.findMany({ where: { id: { in: changedIds } } });
    await Promise.all(changed.map((task) => this.syncReminder(task)));
    return { ...result.updated, affectedOccurrenceIds: result.removedIds, newOccurrenceIds: result.newIds };
  }

  async remove(userId: string, taskId: string): Promise<{ affectedOccurrenceIds: string[] }> {
    const selected = await this.findOne(userId, taskId);
    const series = selected.seriesId ? await this.findOne(userId, selected.seriesId) : selected;
    if (!series.isRecurring && !selected.parentTaskId && Array.isArray(selected.subTasks)) {
      const partIds = selected.subTasks.map(({ id }) => id);
      await this.prisma.$transaction(async (tx) => {
        await tx.task.deleteMany({ where: { parentTaskId: selected.id } });
        await tx.task.delete({ where: { id: selected.id } });
      });
      await this.safeCancelReminder(selected.id);
      return { affectedOccurrenceIds: [selected.id, ...partIds] };
    }
    const ids = series.isRecurring
      ? (await this.prisma.task.findMany({ where: { seriesId: series.id }, select: { id: true } })).map(({ id }) => id)
      : [selected.id];
    await this.prisma.task.delete({ where: { id: series.isRecurring ? series.id : selected.id } });
    await Promise.all(ids.map((id) => this.safeCancelReminder(id)));
    return { affectedOccurrenceIds: ids };
  }

  /** Atomically records the first explicit start; concurrent retries cannot replace it. */
  async start(userId: string, taskId: string): Promise<Task> {
    const existing = await this.findOne(userId, taskId);
    if (existing.isRecurring) throw new BadRequestException('Начните конкретную задачу повтора');
    if (existing.parentTaskId) throw new BadRequestException('Часть задачи нельзя запускать отдельно');
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

    if (!task.parentTaskId) await this.syncReminder(updated);
    return updated;
  }

  private validatePartDraft(parts: TaskPartWriteDto[] | undefined, mode: 'create' | 'update'): void {
    if (!parts) return;
    if (parts.length > MAX_MANUAL_TASK_PARTS) {
      throw new BadRequestException(`Можно добавить не больше ${MAX_MANUAL_TASK_PARTS} частей задачи`);
    }
    const ids = new Set<string>();
    for (const part of parts) {
      if (!part || typeof part.title !== 'string' || !part.title.trim()) {
        throw new BadRequestException('Название части не может быть пустым');
      }
      if (part.title.trim().length > 240) throw new BadRequestException('Название части слишком длинное');
      const raw = part as TaskPartWriteDto & Record<string, unknown>;
      if ('userId' in raw || 'parentTaskId' in raw || 'startTime' in raw || 'durationMinutes' in raw ||
        'isRecurring' in raw || 'recurrenceRule' in raw || 'reminder' in raw || 'createdAt' in raw ||
        'updatedAt' in raw || 'completedAt' in raw || 'firstStep' in raw || 'subTasks' in raw || 'seriesId' in raw) {
        throw new BadRequestException('Часть содержит недопустимые поля');
      }
      if (part.id) {
        if (ids.has(part.id)) throw new BadRequestException('Нельзя повторять id частей');
        ids.add(part.id);
        if (mode === 'create') throw new BadRequestException('Новые части не могут задавать id');
      }
      if (part.completed !== undefined && typeof part.completed !== 'boolean') {
        throw new BadRequestException('completed части должен быть boolean');
      }
    }
  }

  private assertLegacyPartWrite(dto: CreateTaskDto | UpdateTaskDto): void {
    if (dto.startTime != null || dto.durationMinutes != null || dto.firstStep != null ||
      dto.isRecurring === true || dto.recurrenceRule != null || dto.subTasks !== undefined) {
      throw new BadRequestException('Часть не может иметь время, длительность, повтор, первый шаг или вложенные части');
    }
  }

  private partCreateData(userId: string, parentTaskId: string, part: TaskPartWriteDto): Prisma.TaskUncheckedCreateInput {
    return {
      userId,
      parentTaskId,
      title: part.title.trim(),
      completedAt: part.completed ? new Date() : null,
      startTime: null,
      durationMinutes: null,
      color: '#6B5BFC',
      isRecurring: false,
      recurrenceRule: null,
      recurrenceTimezone: null,
      recurrenceDateKey: null,
      recurrenceGeneratedThrough: null,
      recurrenceEndedAt: null,
      seriesId: null,
      firstStep: null,
      startedAt: null,
    };
  }

  /**
   * Единая точка синхронизации напоминания с текущим состоянием задачи:
   * выполненная задача или задача без startTime — напоминание отменяется,
   * иначе — (пере)планируется на актуальное startTime.
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

  /** Maintains an authoritative rolling horizon based on profile-local today. */
  async extendSeries(userId: string, seriesId: string, deviceTimezone?: string): Promise<number> {
    const series = await this.findOne(userId, seriesId);
    if (!series.isRecurring || series.recurrenceEndedAt || !series.startTime || !series.recurrenceRule) return 0;
    if (!SUPPORTED_RULES.includes(series.recurrenceRule as typeof SUPPORTED_RULES[number])) throw new BadRequestException('Неподдерживаемое правило повторения');
    const timezone = await this.resolveSeriesTimezone(series, userId, deviceTimezone);
    const { today, target } = this.horizon(timezone);
    if (series.recurrenceGeneratedThrough && series.recurrenceGeneratedThrough >= target) return 0;
    const anchor = series.recurrenceDateKey || formatInTimeZone(series.startTime, timezone, 'yyyy-MM-dd');
    const first = series.recurrenceGeneratedThrough ? this.addDateKey(series.recurrenceGeneratedThrough, 1) : (anchor > today ? anchor : today);
    if (first > target) return 0;
    const newIds = await this.prisma.$transaction(async (tx) => {
      const ids = await this.insertProjection(tx, series, timezone, first, target);
      await tx.task.update({ where: { id: series.id }, data: { recurrenceTimezone: timezone, recurrenceDateKey: anchor, recurrenceGeneratedThrough: target } });
      return ids;
    });
    const created = await this.prisma.task.findMany({ where: { id: { in: newIds } } });
    await Promise.all(created.map((task) => this.syncReminder(task))); return newIds.length;
  }

  async extendAllSeries(userId: string, deviceTimezone?: string): Promise<number> {
    const rows = await this.prisma.task.findMany({ where: { userId, isRecurring: true, recurrenceEndedAt: null, seriesId: null }, select: { id: true } });
    let count = 0; for (const { id } of rows) count += await this.extendSeries(userId, id, deviceTimezone); return count;
  }

  /** Deterministic batches; one malformed series cannot abort the rest. */
  async renewRecurrenceHorizons(batchSize = 100): Promise<number> {
    let cursor: string | undefined; let total = 0;
    do {
      const rows = await this.prisma.task.findMany({ where: { isRecurring: true, recurrenceEndedAt: null, seriesId: null },
        select: { id: true, userId: true }, orderBy: { id: 'asc' }, take: batchSize,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }) });
      for (const row of rows) {
        try { total += await this.extendSeries(row.userId, row.id); }
        catch { this.logger.error('Recurrence horizon extension failed'); }
      }
      cursor = rows.length === batchSize ? rows[rows.length - 1].id : undefined;
      if (rows.length < batchSize) break;
    } while (cursor);
    return total;
  }

  private horizon(timezone: string): { today: string; target: string } {
    const today = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd'); return { today, target: this.addDateKey(today, RECURRENCE_HORIZON_DAYS) };
  }

  private async insertProjection(tx: Prisma.TransactionClient, series: Task, timezone: string, first: string, target: string): Promise<string[]> {
    const wall = formatInTimeZone(series.startTime!, timezone, 'HH:mm:ss'); const candidates: Prisma.TaskCreateManyInput[] = [];
    for (let key = first; key <= target; key = this.addDateKey(key, 1)) {
      const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
      if (series.recurrenceRule === 'FREQ=DAILY' || (weekday >= 1 && weekday <= 5)) candidates.push({ id: randomUUID(), userId: series.userId,
        title: series.title, firstStep: series.firstStep, durationMinutes: series.durationMinutes, color: series.color,
        startTime: fromZonedTime(`${key}T${wall}`, timezone), seriesId: series.id, recurrenceDateKey: key, isRecurring: false, recurrenceRule: series.recurrenceRule });
    }
    if (!candidates.length) return [];
    await tx.task.createMany({ data: candidates, skipDuplicates: true });
    const inserted = await tx.task.findMany({ where: { id: { in: candidates.map(({ id }) => id!) } }, select: { id: true } });
    return inserted.map(({ id }) => id);
  }

  private addDateKey(key: string, days: number): string { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

  private async resolveSeriesTimezone(series: Task, userId: string, deviceTimezone?: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    for (const timezone of [series.recurrenceTimezone, user?.timezone, deviceTimezone]) {
      if (!timezone) continue; try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); return timezone; } catch { /* next explicit candidate */ }
    }
    throw new BadRequestException('Нужен допустимый timezone профиля или устройства');
  }

  private assertRecurrence(isRecurring?: boolean, rule?: string | null, startTime?: string | null, parentTaskId?: string | null, occurrenceSeriesId?: string | null): void {
    if (!isRecurring && rule && !occurrenceSeriesId) throw new BadRequestException('recurrenceRule требует isRecurring=true');
    if (isRecurring && (!rule || !SUPPORTED_RULES.includes(rule as typeof SUPPORTED_RULES[number]))) throw new BadRequestException('Выберите поддерживаемый тип повтора');
    if (isRecurring && !startTime) throw new BadRequestException('Повторяющейся задаче нужны дата и время');
    if (isRecurring && parentTaskId) throw new BadRequestException('Подзадача не может быть серией');
  }

  private async profileTimezone(userId: string, deviceTimezone?: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const candidates = [user?.timezone, deviceTimezone];
    for (const timezone of candidates) {
      if (!timezone) continue;
      try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); return timezone; } catch { /* explicit next candidate */ }
    }
    throw new BadRequestException('Нужен допустимый timezone профиля или устройства');
  }

}
