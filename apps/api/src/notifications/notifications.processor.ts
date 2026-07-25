import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService, TaskReminderJobData } from './notifications.service';
import { TASK_REMINDERS_QUEUE, JOBS } from './notifications.constants';

/**
 * BullMQ Processor — воркер, который забирает задачи из Redis-очереди
 * и отправляет push-уведомления.
 *
 * Ключевое для надёжности:
 * - Каждый job имеет attempts: 3 с exponential backoff
 * - Все результаты (успех/ошибка) пишутся в NotificationLog
 * - Processor изолирован от HTTP-слоя — работает независимо
 */
@Processor(TASK_REMINDERS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<TaskReminderJobData>): Promise<void> {
    this.logger.log(`Обрабатываю job [${job.name}] id=${job.id} taskId=${job.data.taskId}`);

    if (job.name === JOBS.TASK_REMINDER) {
      await this.handleTaskReminder(job.data);
    } else {
      this.logger.warn(`Неизвестный тип job: ${job.name}`);
    }
  }

  private async handleTaskReminder(data: TaskReminderJobData): Promise<void> {
    const { taskId, userId, taskTitle } = data;

    const delivered = await this.notificationsService.sendPushNotification(
      userId,
      '⏰ Время начинать!',
      `Задача: ${taskTitle}`,
    );

    // Записываем результат независимо от успеха/ошибки — для мониторинга
    await this.notificationsService.logNotification(userId, taskId, delivered);

    if (!delivered) {
      // Бросаем ошибку — BullMQ выполнит retry согласно настройкам job
      throw new Error(`Push не доставлен для задачи ${taskId}`);
    }
  }
}
