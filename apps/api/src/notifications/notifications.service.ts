import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TASK_REMINDERS_QUEUE, JOBS } from './notifications.constants';
import type { Task } from '@prisma/client';

/** Данные, передаваемые в BullMQ job */
export interface TaskReminderJobData {
  taskId: string;
  userId: string;
  taskTitle: string;
  scheduledFor: string; // ISO 8601
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(TASK_REMINDERS_QUEUE)
    private readonly taskReminderQueue: Queue<TaskReminderJobData>,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Планирует push-напоминание о задаче.
   * Если задача без startTime — ничего не делаем.
   * Если до startTime < 5 сек — тоже пропускаем (уже прошло).
   *
   * Использует детерминированный jobId = `task-reminder-${task.id}`,
   * что позволяет безболезненно перепланировать при обновлении задачи.
   */
  async scheduleTaskReminder(task: Task): Promise<void> {
    if (!task.startTime) return;

    const now = Date.now();
    const startMs = task.startTime.getTime();
    const delayMs = startMs - now;

    // Отменяем ранее запланированное напоминание для этой задачи (если было)
    await this.cancelTaskReminder(task.id);

    if (delayMs < 5_000) {
      this.logger.debug(`Задача ${task.id}: start уже прошёл, напоминание не ставим`);
      return;
    }

    const jobId = `task-reminder-${task.id}`;
    const jobData: TaskReminderJobData = {
      taskId: task.id,
      userId: task.userId,
      taskTitle: task.title,
      scheduledFor: task.startTime.toISOString(),
    };

    await this.taskReminderQueue.add(JOBS.TASK_REMINDER, jobData, {
      jobId,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 10, // оставляем последние 10 ошибок для отладки
      attempts: 3,      // 3 попытки при сбое
      backoff: { type: 'exponential', delay: 30_000 }, // ретрай через 30с, 60с, 120с
    });

    this.logger.log(
      `Напоминание запланировано: задача "${task.title}" (${task.id}) через ${Math.round(delayMs / 60_000)} мин`,
    );
  }

  /**
   * Отменяет запланированное напоминание при удалении/обновлении задачи.
   */
  async cancelTaskReminder(taskId: string): Promise<void> {
    const jobId = `task-reminder-${taskId}`;
    const existing = await this.taskReminderQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
      this.logger.debug(`Напоминание отменено: задача ${taskId}`);
    }
  }

  /**
   * Фактически отправляет Expo push-уведомление через HTTP API.
   * Вызывается из NotificationsProcessor.
   */
  async sendPushNotification(userId: string, title: string, body: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });

    if (!user?.expoPushToken) {
      this.logger.warn(`Нет push-токена для пользователя ${userId} — уведомление пропущено`);
      return false;
    }

    const token = user.expoPushToken;

    try {
      // Отправка через Expo Push API (без лишних данных в теле — 152-ФЗ, п.7 ТЗ)
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { 'Authorization': `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: token,
          title,
          body,
          sound: 'default',
          // НЕ передаём taskId или детали задачи в data — только безобидный флаг
          data: { type: 'task-reminder' },
        }),
      });

      const result = (await response.json()) as { data?: { status: string; message?: string } };
      const status = result.data?.status;

      if (status === 'ok') {
        this.logger.log(`Push отправлен пользователю ${userId}`);
        return true;
      } else {
        this.logger.warn(`Expo push вернул статус "${status}": ${result.data?.message}`);
        return false;
      }
    } catch (err) {
      this.logger.error(`Ошибка отправки push пользователю ${userId}:`, err);
      return false;
    }
  }

  /**
   * Записывает факт попытки отправки в NotificationLog.
   * Используется из Processor для трекинга надёжности.
   */
  async logNotification(
    userId: string,
    taskId: string | null,
    delivered: boolean,
  ): Promise<void> {
    await this.prisma.notificationLog.create({
      data: { userId, taskId, delivered },
    });
  }
}
