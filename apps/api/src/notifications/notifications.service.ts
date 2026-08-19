import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TASK_REMINDERS_QUEUE, JOBS } from './notifications.constants';
import type { Task } from '@prisma/client';

/**
 * Compact job payload (ADR-009): only task/user IDs needed for worker lookup.
 * Task title, notes, and other content are NOT stored in the queue payload to
 * prevent PII leakage in Redis and job logs.
 */
export interface TaskReminderJobData {
  taskId: string;
  userId: string;
  scheduledFor: string; // ISO 8601 — for dedup/replay safety
}

/** Per-device delivery outcome in the fan-out result. */
export interface PushDeviceResult {
  tokenId: string;
  /** sent: delivered; already-delivered: skipped (per-device dedup); device-not-registered: revoked; error: retryable */
  outcome: 'sent' | 'already-delivered' | 'device-not-registered' | 'error';
  errorMessage?: string;
}

/** Public result of a fan-out push attempt */
export type PushSendResult =
  | { status: 'sent'; devices: PushDeviceResult[] }
  | { status: 'no-tokens' }
  | { status: 'all-failed'; devices: PushDeviceResult[] };

/** Per-token delivery outcome — used in fan-out loop */
type TokenDeliveryResult =
  | { status: 'sent' }
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

  // ── Scheduling ──────────────────────────────────────────────────────────────

  /**
   * Schedules a BullMQ push reminder for a task.
   * Job payload contains only IDs — never task titles or content (ADR-009).
   */
  async scheduleTaskReminder(task: Task): Promise<void> {
    // Legacy fixtures and cached callers can omit kind; the storage default and
    // compatibility contract treat that shape as an ordinary task.
    if (task.kind && task.kind !== 'TASK') {
      await this.cancelTaskReminder(task.id);
      return;
    }
    if (!task.startTime) return;

    const now = Date.now();
    const startMs = task.startTime.getTime();
    const delayMs = startMs - now;

    await this.cancelTaskReminder(task.id);

    if (delayMs < 5_000) {
      this.logger.debug(`Task start already passed, reminder skipped`);
      return;
    }

    const jobId = `task-reminder-${task.id}`;
    const jobData: TaskReminderJobData = {
      taskId: task.id,
      userId: task.userId,
      scheduledFor: task.startTime.toISOString(),
    };

    await this.taskReminderQueue.add(JOBS.TASK_REMINDER, jobData, {
      jobId,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 10,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
    });

    this.logger.log(
      `Reminder scheduled: outcome=queued, delayMin=${Math.round(delayMs / 60_000)}`,
    );
  }

  async cancelTaskReminder(taskId: string): Promise<void> {
    const jobId = `task-reminder-${taskId}`;
    const existing = await this.taskReminderQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
      this.logger.debug(`Reminder cancelled: outcome=removed`);
    }
  }

  // ── Device token management (ADR-009) ─────────────────────────────────────

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
    label?: string,
  ): Promise<{ id: string; token: string; platform: string }> {
    const existing = await this.prisma.deviceToken.findUnique({
      where: { token },
    });

    if (existing) {
      // Security: a token owned by another user cannot be silently reassigned.
      // This prevents ownership-takeover attacks (Task 0011A finding 8).
      if (existing.userId !== userId) {
        throw new ConflictException(
          'This device token is already registered to another account. ' +
          'If this is your device, sign in with the original account and remove the token first.',
        );
      }

      // Same user, previously revoked → restore (idempotent).
      if (existing.revokedAt !== null) {
        await this.prisma.deviceToken.update({
          where: { id: existing.id },
          data: { revokedAt: null, platform, label: label ?? existing.label },
        });
        this.logger.debug(`Device token restored: outcome=unrevoked`);
      }
      // Same user, active → already registered, no write needed.
      return { id: existing.id, token: existing.token, platform };
    }

    const created = await this.prisma.deviceToken.create({
      data: { userId, token, platform, label },
    });
    this.logger.log(`Device token registered: outcome=created, platform=${platform}`);
    return { id: created.id, token: created.token, platform: created.platform };
  }

  async removeDeviceToken(userId: string, tokenId: string): Promise<boolean> {
    const token = await this.prisma.deviceToken.findUnique({
      where: { id: tokenId },
    });

    if (!token || token.userId !== userId) {
      return false;
    }

    await this.prisma.deviceToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Device token removed: outcome=revoked`);
    return true;
  }

  // ── Push delivery (multi-device fan-out) ──────────────────────────────────

  /**
   * Sends a generic, privacy-safe push notification to ALL active device tokens
   * for the given user. Checks per-device dedup before sending each token so a
   * retry only reaches devices that have not yet received the delivery.
   *
   * @param userId  Owner of the device tokens.
   * @param taskId  Used as the per-device dedup key (0011B blocker 4).
   */
  async sendPushNotification(userId: string, taskId: string): Promise<PushSendResult> {
    const t0 = Date.now();

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, token: true },
    });

    // Fall back to legacy single-token field during migration period
    if (deviceTokens.length === 0) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { expoPushToken: true },
      });
      if (!user?.expoPushToken) {
        this.logger.warn(
          `Reminder delivery: outcome=no-tokens, latencyMs=${Date.now() - t0}`,
        );
        return { status: 'no-tokens' };
      }
      deviceTokens.push({ id: '__legacy__', token: user.expoPushToken });
    }

    const devices: PushDeviceResult[] = [];

    for (const device of deviceTokens) {
      // Per-device dedup: skip if this device already received this task's reminder.
      // This prevents re-sending to a device that succeeded on a prior attempt while
      // another device failed (0011B blocker 4 fix for task-global precheck problem).
      const alreadyDelivered = await this.wasRecentlyDelivered(taskId, device.id);
      if (alreadyDelivered) {
        devices.push({ tokenId: device.id, outcome: 'already-delivered' });
        continue;
      }

      const result = await this._sendToToken(device.token);

      if (result.status === 'sent') {
        devices.push({ tokenId: device.id, outcome: 'sent' });
      } else if (result.status === 'device-not-registered') {
        await this._revokeToken(device.id, userId);
        devices.push({ tokenId: device.id, outcome: 'device-not-registered' });
      } else {
        devices.push({ tokenId: device.id, outcome: 'error', errorMessage: result.message });
      }
    }

    const latencyMs = Date.now() - t0;
    const sentCount = devices.filter((d) => d.outcome === 'sent').length;
    const errorCount = devices.filter((d) => d.outcome === 'error').length;
    const skippedCount = devices.filter((d) => d.outcome === 'already-delivered').length;

    if (sentCount > 0) {
      this.logger.log(
        `Reminder delivery: outcome=sent, sentCount=${sentCount}, errorCount=${errorCount}, skippedCount=${skippedCount}, totalTokens=${deviceTokens.length}, latencyMs=${latencyMs}`,
      );
      return { status: 'sent', devices };
    }

    // All tokens either failed or were already delivered.
    this.logger.warn(
      `Reminder delivery: outcome=all-failed, totalTokens=${deviceTokens.length}, latencyMs=${latencyMs}`,
    );
    return { status: 'all-failed', devices };
  }

  private async _sendToToken(token: string): Promise<TokenDeliveryResult> {
    try {
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
          // Generic, non-sensitive content (ADR-009 §5, Package 0001 §7):
          // No task title, notes, IDs, or user content in push payloads.
          title: 'Focus',
          body: 'Пора начинать',
          sound: 'default',
          data: { type: 'task-reminder' },
        }),
      });

      const result = (await response.json()) as {
        data?: { status: string; message?: string; details?: { error?: string } };
      };
      const ticket = result.data;

      if (ticket?.status === 'ok') return { status: 'sent' };
      if (ticket?.details?.error === 'DeviceNotRegistered') return { status: 'device-not-registered' };

      return { status: 'error', message: ticket?.message ?? 'unknown' };
    } catch (err) {
      const failureClass = err instanceof Error ? err.constructor.name : 'Unknown';
      this.logger.error(`Push delivery failed: failureClass=${failureClass}`);
      return { status: 'error', message: (err as Error).message };
    }
  }

  private async _revokeToken(tokenId: string, userId: string): Promise<void> {
    if (tokenId === '__legacy__') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { expoPushToken: null },
      });
    } else {
      await this.prisma.deviceToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      });
    }
    this.logger.log(`Device token revoked: outcome=DeviceNotRegistered`);
  }

  // ── Logging & deduplication ───────────────────────────────────────────────

  async logNotification(
    userId: string,
    taskId: string | null,
    delivered: boolean,
    deviceTokenId?: string | null,
  ): Promise<void> {
    await this.prisma.notificationLog.create({
      data: {
        userId,
        taskId,
        delivered,
        ...(deviceTokenId && deviceTokenId !== '__legacy__' ? { deviceTokenId } : {}),
      },
    });
  }

  /**
   * Per-device deduplication check: was this task/device combination delivered recently?
   * Falls back to task-level check when deviceTokenId is not available (legacy path).
   */
  async wasRecentlyDelivered(
    taskId: string,
    deviceTokenId?: string | null,
    withinMs = 2 * 60_000,
  ): Promise<boolean> {
    const where: Record<string, unknown> = {
      taskId,
      delivered: true,
      sentAt: { gte: new Date(Date.now() - withinMs) },
    };
    if (deviceTokenId && deviceTokenId !== '__legacy__') {
      where['deviceTokenId'] = deviceTokenId;
    }
    const recent = await this.prisma.notificationLog.findFirst({ where });
    return !!recent;
  }
}
