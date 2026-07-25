import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NotificationsService, TaskReminderJobData } from './notifications.service';
import { TASK_REMINDERS_QUEUE, JOBS } from './notifications.constants';

@Processor(TASK_REMINDERS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<TaskReminderJobData>): Promise<void> {
    if (job.name !== JOBS.TASK_REMINDER) return;

    const { taskId, userId, taskTitle } = job.data;

    // Доп. страховка от задвоения (помимо детерминированного jobId при постановке в очередь)
    const alreadySent = await this.notifications.wasRecentlyDelivered(taskId);
    if (alreadySent) {
      this.logger.debug(`Напоминание по задаче ${taskId} уже было доставлено недавно — пропуск`);
      return;
    }

    const result = await this.notifications.sendPushNotification(
      userId,
      'Пора начинать',
      taskTitle,
    );

    const delivered = result.status === 'sent';
    await this.notifications.logNotification(userId, taskId, delivered);

    // no-token / device-not-registered — ретраить бессмысленно (токен уже очищен/отсутствует)
    if (result.status === 'error') {
      // Бросаем ошибку — BullMQ применит retry/backoff, заданные при постановке в очередь (3 попытки)
      throw new Error(
        `Push не доставлен пользователю ${userId} по задаче ${taskId}: ${result.message}`,
      );
    }
  }
}
