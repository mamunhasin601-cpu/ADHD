import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanService } from '../plan/plan.service';
import { CreateTaskDto, MAX_MANUAL_TASK_PARTS } from './dto/create-task.dto';
import { TaskPartWriteDto } from './dto/task-part-write.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import { Prisma, type Task } from '@prisma/client';
import type { TaskKind } from '@focus/shared-types';
import { createHash, randomUUID } from 'crypto';
import { formatInTimeZone, fromZonedTime, toDate } from 'date-fns-tz';

const SUPPORTED_RULES = ['FREQ=DAILY', 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'] as const;
const RECURRENCE_HORIZON_DAYS = 60;
const MAX_SCHEDULED_DURATION_MINUTES = 1440;
const START_TRANSACTION_RETRIES = 3;

interface ScheduleCandidate {
  id?: string;
  startTime: Date | null;
  durationMinutes: number | null;
}

interface ScheduleStore {
  task: {
    findMany(args: unknown): Promise<Array<{
      id: string;
      startTime: Date | null;
      durationMinutes: number | null;
    }>>;
  };
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly planService: PlanService,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task & { newOccurrenceIds?: string[] }> {
    try {
      return await this.createPersisted(userId, dto);
    } catch (error) {
      this.rethrowScheduleConflict(error);
    }
  }

  private async createPersisted(userId: string, dto: CreateTaskDto): Promise<Task & { newOccurrenceIds?: string[] }> {
    const kind = dto.kind ?? 'TASK';
    this.assertCreateKind(dto, kind);
    const hasParts = dto.subTasks !== undefined;
    if (hasParts) {
      this.validatePartDraft(dto.subTasks, 'create');
      if (dto.parentTaskId) throw new BadRequestException('Части можно добавить только к корневой задаче');
      if (dto.isRecurring) throw new BadRequestException('Части недоступны для повторяющихся задач');
    }
    this.assertRecurrence(dto.isRecurring, dto.recurrenceRule, dto.startTime, dto.parentTaskId);
    if (dto.parentTaskId) {
      const parent = await this.findOne(userId, dto.parentTaskId);
      if (this.taskKind(parent) !== 'TASK' || parent.parentTaskId || parent.isRecurring || parent.seriesId) {
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
        kind,
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
    if (!dto.parentTaskId && kind === 'TASK') await this.planService.enforceTaskLimit(userId);

    if (!dto.parentTaskId && !dto.isRecurring && !dto.createRequestId) {
      await this.assertScheduleAvailable(this.prisma, userId, [{
        startTime: start,
        durationMinutes: dto.durationMinutes ?? null,
      }]);
    }

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
          recurrenceRootId: template.id,
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
        if ((data.kind ?? 'TASK') === 'TASK') {
          await this.planService.enforceTaskLimit(userId, tx);
        }

        if (!dto.isRecurring) {
          await this.assertScheduleAvailable(tx as unknown as ScheduleStore, userId, [{
            startTime: data.startTime instanceof Date ? data.startTime : null,
            durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
          }]);
        }

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
              recurrenceRootId: template.id,
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
      kind: data.kind ?? 'TASK',
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
      where['kind'] = 'TASK';
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
      where['kind'] = 'TASK';
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
      where['kind'] = 'TASK';
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
    try {
      return await this.updatePersisted(userId, taskId, dto);
    } catch (error) {
      this.rethrowScheduleConflict(error);
    }
  }

  private async updatePersisted(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task & { affectedOccurrenceIds?: string[]; newOccurrenceIds?: string[] }> {
    const hasParts = dto.subTasks !== undefined;
    if (hasParts) this.validatePartDraft(dto.subTasks, 'update');
    const selected = await this.findOne(userId, taskId);
    const selectedKind = this.taskKind(selected);
    const nextKind = dto.kind ?? selectedKind;
    if (selectedKind === 'TASK' ? nextKind !== 'TASK' : nextKind === 'TASK') {
      throw new BadRequestException('Преобразование задачи в блок или блока в задачу пока недоступно');
    }
    if (selectedKind !== 'TASK') {
      this.assertBlockUpdate(selected, dto, nextKind);
      await this.assertScheduleAvailable(this.prisma, userId, [{
        id: selected.id,
        startTime: dto.startTime !== undefined ? new Date(dto.startTime!) : selected.startTime,
        durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : selected.durationMinutes,
      }], [selected.id]);
      const block = await this.prisma.task.update({
        where: { id: selected.id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.startTime !== undefined && { startTime: new Date(dto.startTime!) }),
          ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        },
        include: { subTasks: true },
      });
      await this.syncReminder(block);
      return block;
    }

    // A concrete recurrence occurrence can be moved to Thoughts without
    // changing the rest of its series. Detaching keeps the task and its
    // completion/start history, while removing only this occurrence's time.
    const directOccurrenceThoughtsMove = Boolean(selected.seriesId) &&
      dto.startTime === null &&
      Object.keys(dto).every((key) => key === 'startTime');
    if (directOccurrenceThoughtsMove) {
      const task = await this.prisma.task.update({
        where: { id: selected.id },
        data: {
          startTime: null,
          seriesId: null,
          recurrenceRootId: null,
          recurrenceDateKey: null,
          recurrenceRule: null,
          recurrenceTimezone: null,
        },
        include: { subTasks: true },
      });
      await this.syncReminder(task);
      return { ...task, affectedOccurrenceIds: [selected.id] };
    }
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
          recurrenceRootId: series.recurrenceRootId ?? series.id,
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
      if (!selected.parentTaskId) {
        await this.assertScheduleAvailable(this.prisma, userId, [{
          id: selected.id,
          startTime: dto.startTime !== undefined ? (dto.startTime ? new Date(dto.startTime) : null) : selected.startTime,
          durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : selected.durationMinutes,
        }], [selected.id]);
      }
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
      if (!selected.parentTaskId) {
        await this.assertScheduleAvailable(this.prisma, userId, [{
          id: selected.id,
          startTime: dto.startTime !== undefined ? (dto.startTime ? new Date(dto.startTime) : null) : selected.startTime,
          durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : selected.durationMinutes,
        }], [selected.id]);
      }
      const task = await this.prisma.task.update({ where: { id: selected.id }, data: {
        ...(dto.title !== undefined && { title: dto.title }), ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime ? new Date(dto.startTime) : null }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }), ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.completedAt !== undefined && { completedAt: dto.completedAt ? new Date(dto.completedAt) : null }),
      }, include: { subTasks: true } });
      if (!selected.parentTaskId) await this.syncReminder(task);
      return task;
    }
    const recurrenceScope = dto.recurrenceEditScope ?? 'ENTIRE_SERIES';
    if (series.recurrenceEndedAt && recurrenceScope !== 'ENTIRE_SERIES') {
      throw new BadRequestException('Этот повтор уже остановлен');
    }
    const timezone = await this.resolveSeriesTimezone(series, userId, dto.deviceTimezone);
    const { today, target } = this.horizon(timezone);
    const logicalSeries = recurrenceScope === 'ENTIRE_SERIES'
      ? await this.findRecurrenceFamily(userId, series)
      : [series];
    const logicalSeriesIds = logicalSeries.map(({ id }) => id);
    const effectiveSeries = recurrenceScope === 'ENTIRE_SERIES'
      ? [...logicalSeries].reverse().find((candidate) => !candidate.recurrenceEndedAt) ?? series
      : series;
    const occurrenceContent = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.firstStep !== undefined && { firstStep: dto.firstStep }),
      ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
      ...(dto.color !== undefined && { color: dto.color }),
    };

    if (selected.seriesId && recurrenceScope === 'ONLY_THIS') {
      const nextOccurrenceStart = dto.startTime !== undefined
        ? (dto.startTime ? new Date(dto.startTime) : null)
        : selected.startTime;
      await this.assertScheduleAvailable(this.prisma, userId, [{
        id: selected.id,
        startTime: nextOccurrenceStart,
        durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : selected.durationMinutes,
      }], [selected.id]);
      const detach = dto.editRecurrencePattern === true &&
        (dto.isRecurring === false || dto.recurrenceRule == null);
      const occurrence = await this.prisma.task.update({
        where: { id: selected.id },
        data: {
          ...occurrenceContent,
          ...(dto.startTime !== undefined && { startTime: nextOccurrenceStart }),
          ...(detach && {
            seriesId: null,
            recurrenceRootId: null,
            recurrenceDateKey: null,
            recurrenceRule: null,
            recurrenceTimezone: null,
          }),
        },
        include: { subTasks: true },
      });
      await this.syncReminder(occurrence);
      return { ...occurrence, affectedOccurrenceIds: [selected.id], newOccurrenceIds: [] };
    }

    if (selected.seriesId && recurrenceScope === 'THIS_AND_FUTURE') {
      if (!selected.recurrenceDateKey || !selected.startTime) {
        throw new BadRequestException('Recurring occurrence has no split identity');
      }
      if (selected.startedAt || selected.completedAt) {
        throw new BadRequestException('A started or completed occurrence cannot split a series');
      }
      const splitKey = selected.recurrenceDateKey;
      const splitStart = dto.startTime ? new Date(dto.startTime) : selected.startTime;
      const splitRule = dto.editRecurrencePattern ? dto.recurrenceRule : series.recurrenceRule;
      const stopAtSplit = dto.editRecurrencePattern === true &&
        (dto.isRecurring === false || splitRule == null);
      if (!stopAtSplit) this.assertRecurrence(true, splitRule, splitStart.toISOString(), series.parentTaskId);

      const result = await this.prisma.$transaction(async (tx) => {
        const replaceWhere = {
          seriesId: series.id,
          recurrenceDateKey: { gte: splitKey },
          startedAt: null,
          completedAt: null,
        };
        const branchOccurrences = await tx.task.findMany({
          where: { seriesId: series.id, recurrenceDateKey: { gte: splitKey } },
          select: { id: true, startedAt: true, completedAt: true },
        });
        const removed = branchOccurrences.filter((occurrence) => !occurrence.startedAt && !occurrence.completedAt);
        const protectedIds = branchOccurrences
          .filter((occurrence) => occurrence.startedAt || occurrence.completedAt)
          .map(({ id }) => id);
        const removedIds = removed.map(({ id }) => id);
        const permanentlyRemovedIds = stopAtSplit
          ? removedIds.filter((id) => id !== selected.id)
          : removedIds;
        if (permanentlyRemovedIds.length) {
          await tx.recoveryUndoItem.deleteMany({ where: { taskId: { in: permanentlyRemovedIds } } });
        }
        await tx.task.deleteMany({ where: replaceWhere });
        await tx.task.update({
          where: { id: series.id },
          data: {
            recurrenceEndedAt: new Date(),
            recurrenceGeneratedThrough: this.addDateKey(splitKey, -1),
          },
        });

        if (stopAtSplit) {
          const detached = await tx.task.create({
            data: {
              id: selected.id,
              userId,
              title: dto.title ?? selected.title,
              kind: 'TASK',
              firstStep: dto.firstStep !== undefined ? dto.firstStep : selected.firstStep,
              startTime: splitStart,
              durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : selected.durationMinutes,
              color: dto.color ?? selected.color,
              isRecurring: false,
              recurrenceRule: null,
              recurrenceRootId: null,
            },
            include: { subTasks: true },
          });
          return { updated: detached, removedIds: removedIds.filter((id) => id !== selected.id), newIds: [selected.id] };
        }

        const newSeries = await tx.task.create({
          data: {
            id: randomUUID(),
            userId,
            title: dto.title ?? series.title,
            kind: 'TASK',
            firstStep: dto.firstStep !== undefined ? dto.firstStep : series.firstStep,
            startTime: splitStart,
            durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : series.durationMinutes,
            color: dto.color ?? series.color,
            isRecurring: true,
            recurrenceRule: splitRule,
            recurrenceTimezone: timezone,
            recurrenceDateKey: splitKey,
            recurrenceGeneratedThrough: target,
            recurrenceEndedAt: null,
            recurrenceRootId: series.recurrenceRootId ?? series.id,
          },
          include: { subTasks: true },
        });
        if (protectedIds.length) {
          await tx.task.updateMany({
            where: { id: { in: protectedIds } },
            data: { seriesId: newSeries.id, recurrenceRootId: series.recurrenceRootId ?? series.id },
          });
        }
        const insertedIds = await this.insertProjection(tx, newSeries, timezone, splitKey, target, protectedIds);
        return { updated: newSeries, removedIds, newIds: [...protectedIds, ...insertedIds] };
      });
      await Promise.all(result.removedIds.map((id) => this.safeCancelReminder(id)));
      const changed = await this.prisma.task.findMany({ where: { id: { in: result.newIds } } });
      await Promise.all(changed.map((task) => this.syncReminder(task)));
      return { ...result.updated, affectedOccurrenceIds: result.removedIds, newOccurrenceIds: result.newIds };
    }
    const stop = dto.editRecurrencePattern === true && (dto.isRecurring === false || dto.recurrenceRule == null);
    const scheduleChanged = !stop && (dto.editRecurrenceAnchor === true || dto.editRecurrencePattern === true);
    const nextStart = dto.editRecurrenceAnchor && dto.startTime ? new Date(dto.startTime) : effectiveSeries.startTime!;
    const nextRule = dto.editRecurrencePattern ? dto.recurrenceRule : effectiveSeries.recurrenceRule;
    if (!stop) this.assertRecurrence(true, nextRule, nextStart.toISOString(), effectiveSeries.parentTaskId);
    const content = occurrenceContent;

    const result = await this.prisma.$transaction(async (tx) => {
      // Stopping a recurrence is forward-looking even when the logical family spans
      // several technical segments: keep past/today identities and remove only later
      // unstarted occurrences. A schedule rewrite of the whole family may replace all
      // unprotected projections so stale pre-split geometry cannot survive.
      const recurrenceDateFilter = stop
        ? { gt: today }
        : recurrenceScope === 'ENTIRE_SERIES' ? undefined : { gte: today };
      const futureWhere: Prisma.TaskWhereInput = {
        seriesId: recurrenceScope === 'ENTIRE_SERIES' ? { in: logicalSeriesIds } : series.id,
        ...(recurrenceDateFilter && { recurrenceDateKey: recurrenceDateFilter }),
        startedAt: null,
        completedAt: null,
      };
      const removed = (stop || scheduleChanged) ? await tx.task.findMany({ where: futureWhere, select: { id: true } }) : [];
      const protectedIds = scheduleChanged
        ? (await tx.task.findMany({
            where: {
              seriesId: recurrenceScope === 'ENTIRE_SERIES' ? { in: logicalSeriesIds } : series.id,
              ...(recurrenceDateFilter && { recurrenceDateKey: recurrenceDateFilter }),
              OR: [{ startedAt: { not: null } }, { completedAt: { not: null } }],
            },
            select: { id: true },
          })).map(({ id }) => id)
        : [];
      const nextAnchor = dto.editRecurrenceAnchor ? formatInTimeZone(nextStart, timezone, 'yyyy-MM-dd')
        : (effectiveSeries.recurrenceDateKey || formatInTimeZone(effectiveSeries.startTime!, timezone, 'yyyy-MM-dd'));
      const updated = await tx.task.update({ where: { id: effectiveSeries.id }, data: {
        ...content, ...(dto.editRecurrenceAnchor && { startTime: nextStart, recurrenceDateKey: nextAnchor }),
        ...(dto.editRecurrencePattern && !stop && { recurrenceRule: nextRule }),
        ...(stop && { recurrenceEndedAt: new Date(), recurrenceGeneratedThrough: today }),
        ...(scheduleChanged && { recurrenceGeneratedThrough: target }),
      }, include: { subTasks: true } });
      if (recurrenceScope === 'ENTIRE_SERIES' && logicalSeriesIds.length > 1) {
        await tx.task.updateMany({
          where: { id: { in: logicalSeriesIds.filter((id) => id !== effectiveSeries.id) } },
          data: {
            ...content,
            ...(stop && { recurrenceEndedAt: new Date() }),
          },
        });
      }
      if (stop || scheduleChanged) await tx.task.deleteMany({ where: futureWhere });
      else if (Object.keys(content).length) {
        if (dto.durationMinutes !== undefined) {
          const occurrences = await tx.task.findMany({
            where: futureWhere,
            select: { id: true, startTime: true, durationMinutes: true },
          });
          await this.assertScheduleAvailable(
            tx as unknown as ScheduleStore,
            userId,
            occurrences.map((occurrence) => ({ ...occurrence, durationMinutes: dto.durationMinutes ?? null })),
            occurrences.map(({ id }) => id),
          );
        }
        await tx.task.updateMany({ where: futureWhere, data: content });
      }
      if (scheduleChanged && recurrenceScope === 'ENTIRE_SERIES' && protectedIds.length) {
        await tx.task.updateMany({
          where: { id: { in: protectedIds } },
          data: {
            seriesId: effectiveSeries.id,
            recurrenceRootId: effectiveSeries.recurrenceRootId ?? effectiveSeries.id,
          },
        });
      }
      const newIds = scheduleChanged
        ? [
            ...protectedIds,
            ...await this.insertProjection(
              tx,
              { ...updated, startTime: nextStart, recurrenceRule: nextRule } as Task,
              timezone,
              nextAnchor > today ? nextAnchor : today,
              target,
              protectedIds,
            ),
          ]
        : [];
      return { updated, removedIds: removed.map(({ id }) => id), newIds };
    });
    await Promise.all(result.removedIds.map((id) => this.safeCancelReminder(id)));
    const changedIds = scheduleChanged ? result.newIds : (await this.prisma.task.findMany({
      where: {
        seriesId: recurrenceScope === 'ENTIRE_SERIES' ? { in: logicalSeriesIds } : series.id,
        ...(recurrenceScope !== 'ENTIRE_SERIES' && { recurrenceDateKey: { gte: today } }),
        startedAt: null,
        completedAt: null,
      },
      select: { id: true },
    })).map(({ id }) => id);
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
    const logicalSeries = series.isRecurring ? await this.findRecurrenceFamily(userId, series) : [];
    const logicalSeriesIds = logicalSeries.map(({ id }) => id);
    const ids = series.isRecurring
      ? (await this.prisma.task.findMany({ where: { seriesId: { in: logicalSeriesIds } }, select: { id: true } })).map(({ id }) => id)
      : [selected.id];
    if (series.isRecurring) {
      await this.prisma.$transaction(async (tx) => {
        if (ids.length) await tx.recoveryUndoItem.deleteMany({ where: { taskId: { in: ids } } });
        await tx.task.deleteMany({ where: { id: { in: logicalSeriesIds } } });
      });
    } else {
      await this.prisma.task.delete({ where: { id: selected.id } });
    }
    await Promise.all(ids.map((id) => this.safeCancelReminder(id)));
    return { affectedOccurrenceIds: ids };
  }

  /** Enforces one active started task per user and performs an explicit switch atomically. */
  async start(
    userId: string,
    taskId: string,
    confirmSwitch = false,
    confirmEarlyStart = false,
  ): Promise<Task> {
    let task: Task | undefined;
    for (let attempt = 0; attempt < START_TRANSACTION_RETRIES; attempt += 1) {
      try {
        task = await this.prisma.$transaction(async (tx) => {
          const target = await tx.task.findUnique({
            where: { id: taskId },
            include: { subTasks: true },
          });
          if (!target) throw new NotFoundException('Задача не найдена');
          if (target.userId !== userId) throw new ForbiddenException('Нет доступа к этой задаче');
          if (this.taskKind(target) !== 'TASK') throw new BadRequestException('Блок отдыха или буфера нельзя начать как задачу');
          if (target.isRecurring) throw new BadRequestException('Начните конкретную задачу повтора');
          if (target.parentTaskId) throw new BadRequestException('Часть задачи нельзя запускать отдельно');
          if (target.completedAt) throw new ConflictException('Завершённую задачу нельзя начать');

          const startedAt = new Date();
          if (!target.startedAt && target.startTime && target.startTime.getTime() > startedAt.getTime() && !confirmEarlyStart) {
            throw new ConflictException({
              code: 'EARLY_START_CONFIRMATION_REQUIRED',
              message: 'Задача запланирована на более позднее время',
              scheduledTask: { id: target.id, title: target.title, startTime: target.startTime },
            });
          }

          const active = await tx.task.findMany({
            where: { userId, startedAt: { not: null }, completedAt: null },
            orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
          });
          const otherActive = active.filter((candidate) => candidate.id !== taskId);
          if (target.startedAt && (!confirmSwitch || otherActive.length === 0)) return target;
          if (otherActive.length > 0 && !confirmSwitch) {
            const current = otherActive[0];
            throw new ConflictException({
              code: 'ACTIVE_TASK_CONFLICT',
              message: 'Уже выполняется другая задача',
              activeTask: { id: current.id, title: current.title, startedAt: current.startedAt },
            });
          }

          if (confirmSwitch && otherActive.length > 0) {
            await tx.task.updateMany({
              where: { userId, id: { not: taskId }, startedAt: { not: null }, completedAt: null },
              data: { startedAt: null },
            });
          }
          if (target.startedAt) return target;
          const started = await tx.task.updateMany({
            where: { id: taskId, userId, startedAt: null, completedAt: null },
            data: { startedAt },
          });
          if (started.count !== 1) {
            const canonical = await tx.task.findUnique({ where: { id: taskId }, include: { subTasks: true } });
            if (canonical?.completedAt) throw new ConflictException('Завершённую задачу нельзя начать');
            if (canonical?.startedAt) return canonical;
            throw new ConflictException('Состояние задачи изменилось');
          }
          return (await tx.task.findUnique({ where: { id: taskId }, include: { subTasks: true } }))!;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2034' || attempt === START_TRANSACTION_RETRIES - 1) throw error;
      }
    }
    if (!task) throw new ConflictException('Не удалось сериализовать запуск задачи');
    await this.safeCancelReminder(taskId);
    return task;
  }

  /** Отметить задачу как выполненную / невыполненную */
  async toggleComplete(userId: string, taskId: string): Promise<Task> {
    const task = await this.findOne(userId, taskId);
    if (this.taskKind(task) !== 'TASK') throw new BadRequestException('Блок отдыха или буфера нельзя завершить как задачу');
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
        'updatedAt' in raw || 'completedAt' in raw || 'firstStep' in raw || 'subTasks' in raw || 'seriesId' in raw || 'kind' in raw) {
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
      kind: 'TASK',
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
      recurrenceRootId: null,
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
      if (this.taskKind(task) !== 'TASK' || task.completedAt || task.startedAt || !task.startTime) {
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
    if (this.taskKind(series) !== 'TASK') throw new BadRequestException('Блоки не поддерживают повтор');
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
      await tx.task.update({ where: { id: series.id }, data: {
        recurrenceTimezone: timezone,
        recurrenceDateKey: anchor,
        recurrenceGeneratedThrough: target,
        recurrenceRootId: series.recurrenceRootId ?? series.id,
      } });
      return ids;
    });
    const created = await this.prisma.task.findMany({ where: { id: { in: newIds } } });
    await Promise.all(created.map((task) => this.syncReminder(task))); return newIds.length;
  }

  async extendAllSeries(userId: string, deviceTimezone?: string): Promise<number> {
    const rows = await this.prisma.task.findMany({ where: { userId, kind: 'TASK', isRecurring: true, recurrenceEndedAt: null, seriesId: null }, select: { id: true } });
    let count = 0; for (const { id } of rows) count += await this.extendSeries(userId, id, deviceTimezone); return count;
  }

  /** Deterministic batches; one malformed series cannot abort the rest. */
  async renewRecurrenceHorizons(batchSize = 100): Promise<number> {
    let cursor: string | undefined; let total = 0;
    do {
      const rows = await this.prisma.task.findMany({ where: { kind: 'TASK', isRecurring: true, recurrenceEndedAt: null, seriesId: null },
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

  private async insertProjection(
    tx: Prisma.TransactionClient,
    series: Task,
    timezone: string,
    first: string,
    target: string,
    excludeIds: string[] = [],
  ): Promise<string[]> {
    const wall = formatInTimeZone(series.startTime!, timezone, 'HH:mm:ss'); const candidates: Prisma.TaskCreateManyInput[] = [];
    for (let key = first; key <= target; key = this.addDateKey(key, 1)) {
      const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
      if (series.recurrenceRule === 'FREQ=DAILY' || (weekday >= 1 && weekday <= 5)) candidates.push({ id: randomUUID(), userId: series.userId,
        title: series.title, kind: 'TASK', firstStep: series.firstStep, durationMinutes: series.durationMinutes, color: series.color,
        startTime: fromZonedTime(`${key}T${wall}`, timezone), seriesId: series.id,
        recurrenceRootId: series.recurrenceRootId ?? series.id,
        recurrenceDateKey: key, isRecurring: false, recurrenceRule: series.recurrenceRule });
    }
    if (!candidates.length) return [];
    await this.assertScheduleAvailable(
      tx as unknown as ScheduleStore,
      series.userId,
      candidates.map((candidate) => ({
        id: candidate.id,
        startTime: candidate.startTime instanceof Date ? candidate.startTime : null,
        durationMinutes: typeof candidate.durationMinutes === 'number' ? candidate.durationMinutes : null,
      })),
      excludeIds,
    );
    await tx.task.createMany({ data: candidates, skipDuplicates: true });
    const inserted = await tx.task.findMany({ where: { id: { in: candidates.map(({ id }) => id!) } }, select: { id: true } });
    return inserted.map(({ id }) => id);
  }

  /** Resolves every technical segment that belongs to one user-authored series. */
  private async findRecurrenceFamily(userId: string, series: Task): Promise<Task[]> {
    const rootId = series.recurrenceRootId;
    if (!rootId) return [series];
    const family = await this.prisma.task.findMany({
      where: {
        userId,
        isRecurring: true,
        seriesId: null,
        recurrenceRootId: rootId,
      },
      orderBy: [{ recurrenceDateKey: 'asc' }, { createdAt: 'asc' }],
    });
    return family.length ? family : [series];
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

  private taskKind(task: { kind?: TaskKind | null }): TaskKind {
    return task.kind ?? 'TASK';
  }

  /**
   * A known duration owns [start, end). Unknown duration remains honest: it
   * owns its exact start boundary and may end at the next plan boundary.
   * Completion never releases calendar time.
   */
  private async assertScheduleAvailable(
    store: ScheduleStore,
    userId: string,
    candidates: ScheduleCandidate[],
    excludeIds: string[] = [],
  ): Promise<void> {
    const scheduled = candidates.filter((candidate) =>
      candidate.startTime instanceof Date && !Number.isNaN(candidate.startTime.getTime()),
    );
    if (!scheduled.length) return;

    const earliest = Math.min(...scheduled.map((candidate) => candidate.startTime!.getTime()));
    const latest = Math.max(...scheduled.map((candidate) => {
      const duration = this.knownDuration(candidate.durationMinutes);
      return candidate.startTime!.getTime() + (duration ?? 0) * 60_000;
    }));
    const rows = (await store.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        isRecurring: false,
        startTime: {
          gte: new Date(earliest - MAX_SCHEDULED_DURATION_MINUTES * 60_000),
          lt: new Date(latest + 1),
        },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, startTime: true, durationMinutes: true },
      orderBy: { startTime: 'asc' },
    })) ?? [];

    for (const candidate of scheduled) {
      const conflict = rows.find((row) => this.scheduleIntervalsOverlap(candidate, row));
      if (conflict) this.throwScheduleConflict(conflict);
    }
    for (let index = 0; index < scheduled.length; index += 1) {
      for (let other = index + 1; other < scheduled.length; other += 1) {
        if (this.scheduleIntervalsOverlap(scheduled[index], scheduled[other])) {
          this.throwScheduleConflict(scheduled[other]);
        }
      }
    }
  }

  private scheduleIntervalsOverlap(left: ScheduleCandidate, right: ScheduleCandidate): boolean {
    if (!left.startTime || !right.startTime) return false;
    const leftStart = left.startTime.getTime();
    const rightStart = right.startTime.getTime();
    if (leftStart === rightStart) return true;
    const leftDuration = this.knownDuration(left.durationMinutes);
    const rightDuration = this.knownDuration(right.durationMinutes);
    if (leftDuration !== null && rightStart > leftStart) {
      return rightStart < leftStart + leftDuration * 60_000;
    }
    if (rightDuration !== null && leftStart > rightStart) {
      return leftStart < rightStart + rightDuration * 60_000;
    }
    return false;
  }

  private knownDuration(durationMinutes: number | null | undefined): number | null {
    return typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : null;
  }

  private throwScheduleConflict(conflict: ScheduleCandidate): never {
    const duration = this.knownDuration(conflict.durationMinutes);
    throw new ConflictException({
      message: 'Это время уже занято',
      code: 'TASK_TIME_SLOT_OCCUPIED',
      conflictTaskId: conflict.id,
      conflictStartTime: conflict.startTime?.toISOString(),
      conflictEndTime: conflict.startTime && duration !== null
        ? new Date(conflict.startTime.getTime() + duration * 60_000).toISOString()
        : null,
    });
  }

  private rethrowScheduleConflict(error: unknown): never {
    if (error instanceof ConflictException) throw error;
    const candidate = error as { message?: string; meta?: unknown };
    const details = `${candidate?.message ?? ''} ${JSON.stringify(candidate?.meta ?? '')}`;
    if (details.includes('TASK_TIME_SLOT_OCCUPIED')) {
      throw new ConflictException({
        message: 'Это время уже занято',
        code: 'TASK_TIME_SLOT_OCCUPIED',
      });
    }
    throw error;
  }

  private assertCreateKind(dto: CreateTaskDto, kind: TaskKind): void {
    if (kind === 'TASK') return;
    if (kind !== 'REST' && kind !== 'BUFFER') {
      throw new BadRequestException('Неподдерживаемый тип записи');
    }
    if (!dto.startTime || !Number.isInteger(dto.durationMinutes) || (dto.durationMinutes ?? 0) <= 0) {
      throw new BadRequestException('Блоку отдыха или буфера нужны время и положительная длительность');
    }
    if (dto.parentTaskId || dto.isRecurring || dto.recurrenceRule || dto.firstStep ||
      dto.subTasks !== undefined || dto.editRecurrenceAnchor || dto.editRecurrencePattern) {
      throw new BadRequestException('Блок отдыха или буфера не может иметь повтор, первый шаг, части или родителя');
    }
  }

  private assertBlockUpdate(selected: Task, dto: UpdateTaskDto, nextKind: TaskKind): void {
    if (nextKind !== 'REST' && nextKind !== 'BUFFER') {
      throw new BadRequestException('Блок можно изменить только между отдыхом и буфером');
    }
    if (dto.firstStep !== undefined || dto.color !== undefined || dto.isRecurring !== undefined ||
      dto.recurrenceRule !== undefined || dto.parentTaskId !== undefined || dto.subTasks !== undefined ||
      dto.completedAt !== undefined || dto.editRecurrenceAnchor !== undefined ||
      dto.editRecurrencePattern !== undefined) {
      throw new BadRequestException('Для блока можно изменить только название, тип, время и длительность');
    }
    const nextStart = dto.startTime === undefined ? selected.startTime : dto.startTime ? new Date(dto.startTime) : null;
    const nextDuration = dto.durationMinutes === undefined ? selected.durationMinutes : dto.durationMinutes;
    if (!nextStart || Number.isNaN(nextStart.getTime()) || !Number.isInteger(nextDuration) || (nextDuration ?? 0) <= 0) {
      throw new BadRequestException('Блоку отдыха или буфера нужны время и положительная длительность');
    }
  }

}
