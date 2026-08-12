import {
  Injectable,
  Logger,
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RescheduleItemDto } from './dto/reschedule-recovery.dto';
import { RescheduleRecoveryResponseDto } from './dto/reschedule-recovery-response.dto';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import type { Task } from '@prisma/client';

@Injectable()
export class TaskRecoveryService {
  private readonly logger = new Logger(TaskRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Вычисляет начало текущего локального дня вIANA timezone пользователя.
   * Единственный разрешённый метод для вычисления day boundary (ADR-008 D-2).
   */
  private getLocalDayStart(timezone: string, referenceInstant: Date): Date {
    // Получаем строку YYYY-MM-DD в timezone пользователя
    const localDateStr = formatInTimeZone(referenceInstant, timezone, 'yyyy-MM-dd');
    // Интерпретируем 00:00:00 в timezone пользователя → UTC Date
    return toDate(`${localDateStr}T00:00:00`, { timeZone: timezone });
  }

  /**
   * GET /tasks/recovery
   * Возвращает просроченные задачи пользователя согласно определению ADR-008 D-1.
   */
  async getOverdueTasks(
    userId: string,
    referenceInstant: Date = new Date(),
  ): Promise<{ tasks: Task[]; userTimezone: string; localDayStart: string }> {
    const t0 = Date.now();

    // Получаем timezone пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const userTimezone = user?.timezone ?? 'UTC';

    // Вычисляем начало текущего локального дня (ADR-008 D-2)
    const localDayStart = this.getLocalDayStart(userTimezone, referenceInstant);

    // Запрос просроченных задач (ADR-008 D-1)
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,        // только root tasks (D-1.2)
        completedAt: null,         // только незавершённые (D-1.3)
        isRecurring: false,        // исключаем recurring (D-1.4, D-5)
        startTime: {
          not: null,               // только запланированные (D-1.5)
          lt: localDayStart,       // строго до начала сегодняшнего дня (D-1.6)
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Observability contract (ADR-008 / Package 0001 / Task 0009):
    // allowed fields: outcome, overdueCount, latencyMs.
    // Forbidden: userId, taskId, task titles, timezone, localDayStart, tokens,
    // destinations, or any user-owned content.
    this.logger.debug(
      `Recovery query: outcome=ok, overdueCount=${tasks.length}, latencyMs=${Date.now() - t0}`,
    );

    return {
      tasks,
      userTimezone,
      localDayStart: localDayStart.toISOString(),
    };
  }

  /**
   * POST /tasks/recovery/reschedule
   * Атомарно переносит выбранные просроченные задачи на явно указанные destinations.
   * Никогда не вычисляет destination самостоятельно (ADR-008 D-7).
   */
  async rescheduleOverdueTasks(
    userId: string,
    items: RescheduleItemDto[],
    referenceInstant: Date = new Date(),
  ): Promise<RescheduleRecoveryResponseDto> {
    const t0 = Date.now();
    if (items.length === 0) {
      throw new UnprocessableEntityException('items array cannot be empty');
    }

    // Проверка duplicate taskIds в batch
    const taskIds = items.map((i) => i.taskId);
    const uniqueIds = new Set(taskIds);
    if (uniqueIds.size !== taskIds.length) {
      throw new UnprocessableEntityException('items array contains duplicate taskId values');
    }

    // Получаем timezone пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const userTimezone = user?.timezone ?? 'UTC';
const localDayStart = this.getLocalDayStart(userTimezone, referenceInstant);

    // --- Валидация destinations (ADR-008 D-3) ---
    // Идентификаторы задач в сообщениях не используются: позиция в batch
    // достаточна для отладки и не утекает в логи (Task 0007A finding 5).
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.targetStartTime !== null && item.targetStartTime !== undefined) {
        const dest = new Date(item.targetStartTime);
        if (isNaN(dest.getTime())) {
          throw new UnprocessableEntityException(
            `Invalid targetStartTime at items[${i}]: not a valid ISO-8601 date`,
          );
        }
        // Destination обязан быть строго в будущем относительно текущего момента.
        // Проверки "не раньше начала локального дня" недостаточно: она пропускала
        // время, которое уже прошло сегодня (Task 0007A finding 2).
        // Равенство текущему моменту тоже отклоняется — переносить задачу "на
        // сейчас" смысла не имеет и напоминание уже не сработает.
        if (dest.getTime() <= referenceInstant.getTime()) {
          throw new UnprocessableEntityException(
            `targetStartTime at items[${i}] must be strictly in the future`,
          );
        }
      }
    }

    // --- Batch ownership check (ADR-008 D-8) ---
    // Загружаем все задачи одним запросом — избегаем N+1
    const existingTasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select:{
        id: true,
        userId: true,
        completedAt: true,
        startTime: true,
        isRecurring: true,
        parentTaskId: true,
      },
    });

    // Проверяем, что все задачи найдены
    if (existingTasks.length !== taskIds.length) {
      const foundIds = new Set(existingTasks.map((t) => t.id));
      const missingIds = taskIds.filter((id) => !foundIds.has(id));
      throw new ForbiddenException(
        `Tasks not found or access denied: ${missingIds.join(', ')}`,
      );
    }

    // Проверяем ownership (ADR-008 D-8)
    const foreignTasks = existingTasks.filter((t) => t.userId !== userId);
    if (foreignTasks.length > 0) {
      throw new ForbiddenException(
        `Access denied to tasks: ${foreignTasks.map((t) => t.id).join(', ')}`,
      );
    }

    // Enforce recovery eligibility in the write itself so a concurrent completion
    // or reschedule cannot be overwritten.
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const newStartTime =
          item.targetStartTime != null ? new Date(item.targetStartTime) : null;

        const result = await tx.task.updateMany({
          where: {
            id: item.taskId,
            userId,
            completedAt: null,
            parentTaskId: null,
            isRecurring: false,
            startTime: { not: null, lt: localDayStart },
          },
          data: { startTime: newStartTime },
        });

        if (result.count !== 1) {
          throw new ConflictException({
            message:
              'Some tasks are no longer overdue or have changed since the recovery list was loaded',
            code: 'STALE_RECOVERY_STATE',
            staleTaskIds: [item.taskId],
          });
        }
      }
    });

    const updatedTasks = await this.prisma.task.findMany({
      where: {
        id: { in: taskIds },
        userId,
      },
    });

    this.logger.log(
      // Observability contract (ADR-008 / Package 0001 / Task 0009):
      // allowed: outcome, updatedCount, latencyMs, reminderSyncStatus.
      // Forbidden: userId, taskId, task titles, timezone, destinations, payloads.
      `Recovery reschedule committed: outcome=ok, updatedCount=${updatedTasks.length}, latencyMs=${Date.now() - t0}`,
    );

    // --- Reminder sync после commit (ADR-008 D-4) ---
    //Ошибки queue НЕ откатывают task update
    const failedReminderSyncs: string[] = [];
    for (const task of updatedTasks) {
      try {
        if (task.completedAt || !task.startTime) {
          await this.notifications.cancelTaskReminder(task.id);
        } else {
          await this.notifications.scheduleTaskReminder(task);
        }
      } catch (err) {
        // Failure class only — no task id or title in the log line. The task id
        // still travels in the response body so the client can act on it; it
        // just does not reach the log sink (Task 0007A finding 5).
        this.logger.error(
          `Reminder sync failed after recovery commit: failureClass=` +
          `${err instanceof Error ? err.constructor.name : 'Unknown'}`,
        );
        failedReminderSyncs.push(task.id);
      }
    }

    const reminderSyncStatus = failedReminderSyncs.length === 0 ? 'ok' : 'partial';

    if (reminderSyncStatus === 'partial') {
      // Allowed fields only (Package 0001 / ADR-008 / Task 0010):
      // reminderSyncStatus, counts, latencyMs. No identifiers.
      this.logger.warn(
        `Recovery reminder sync partial: reminderSyncStatus=partial, ` +
        `committedCount=${updatedTasks.length}, ` +
        `failedReminderCount=${failedReminderSyncs.length}, ` +
        `latencyMs=${Date.now() - t0}`,
      );
    }

    return {
      updatedCount: updatedTasks.length,
      taskUpdateStatus: 'ok',
      reminderSyncStatus,
      ...(failedReminderSyncs.length > 0 && { failedReminderSyncs }),
    };
  }
}
