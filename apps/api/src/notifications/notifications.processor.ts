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

    const { taskId, userId } = job.data;
    // taskTitle is intentionally NOT in the job payload (ADR-009 privacy contract).

    // No task-global dedup precheck here (0011B blocker 4 fix).
    // Per-device dedup is inside sendPushNotification: each device is checked
    // against the NotificationLog before being sent, so retries only reach
    // devices that have not yet received the delivery.
    const result = await this.notifications.sendPushNotification(userId, taskId);

    if (result.status === 'no-tokens') {
      await this.notifications.logNotification(userId, taskId, false, null);
      return;
    }

    // Log per-device outcomes for every attempted (non-skipped) device.
    // Devices with outcome 'already-delivered' were skipped by per-device dedup
    // and already have a log entry from a prior attempt — do not double-log.
    for (const device of result.devices) {
      if (device.outcome === 'already-delivered') continue;
      const delivered = device.outcome === 'sent';
      await this.notifications.logNotification(userId, taskId, delivered, device.tokenId);
    }

    // If ANY device has a retryable error, throw so BullMQ retries the job.
    // On retry, per-device dedup inside sendPushNotification will skip devices
    // already recorded as delivered and only re-attempt the failed ones.
    const hasRetryable = result.devices.some((d) => d.outcome === 'error');
    if (hasRetryable) {
      // No userId/taskId in the error message to avoid PII in retry logs.
      throw new Error('Some device tokens failed delivery; will retry');
    }
  }
}
