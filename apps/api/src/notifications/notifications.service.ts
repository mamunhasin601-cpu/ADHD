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

/** Результат попытки отправки push-уведомления через Expo */
export type PushSendResult =
  | { status: 'sent' }
  | { status: 'no-token' }
  | { status: 'device-not-registered' }
  | { status: 'error'; message: string };

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
   *
   * Обрабатывает DeviceNotRegistered — если Expo сообщает, что токен мёртв,
   * очищаем его в БД, чтобы не слать в пустоту и не забивать очередь ретраями.
   * Мобильное приложение должно перерегистрировать токен при следующем запуске.
   */
  async sendPushNotification(userId: string, title: string, body: string): Promise<PushSendResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });

    if (!user?.expoPushToken) {
      this.logger.warn(`Нет push-токена для пользователя ${userId} — уведомление пропущено`);
      return { status: 'no-token' };
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

      const result = (await response.json()) as {
        data?: { status: string; message?: string; details?: { error?: string } };
      };
      const ticket = result.data;

      if (ticket?.status === 'ok') {
        this.logger.log(`Push отправлен пользователю ${userId}`);
        return { status: 'sent' };
      }

      if (ticket?.details?.error === 'DeviceNotRegistered') {
        this.logger.warn(`Токен пользователя ${userId} невалиден (DeviceNotRegistered) — очищаем`);
        await this.prisma.user.update({
          where: { id: userId },
          data: { expoPushToken: null },
        });
        return { status: 'device-not-registered' };
      }

      this.logger.warn(`Expo push вернул статус "${ticket?.status}": ${ticket?.message}`);
      return { status: 'error', message: ticket?.message ?? 'unknown' };
    } catch (err) {
      this.logger.error(`Ошибка отправки push пользователю ${userId}:`, err);
      return { status: 'error', message: (err as Error).message };
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

  /**
   * Доп. страховка от задвоения уведомлений (помимо детерминированного jobId в BullMQ):
   * если по этой задаче уже есть свежая успешная доставка — не шлём повторно.
   */
  async wasRecentlyDelivered(taskId: string, withinMs = 2 * 60_000): Promise<boolean> {
    const recent = await this.prisma.notificationLog.findFirst({
      where: {
        taskId,
        delivered: true,
        sentAt: { gte: new Date(Date.now() - withinMs) },
      },
    });
    return !!recent;
  }
}
