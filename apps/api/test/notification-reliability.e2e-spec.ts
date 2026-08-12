/**
 * E2E: Notification Reliability (Task 0011A — rewritten to match current contract).
 *
 * Tests the full path:
 *   DeviceToken registration → task creation → BullMQ job → worker delivery → NotificationLog
 *
 * REQUIRES:
 *  - Running Redis and PostgreSQL (docker compose up -d)
 *  - Applied migrations (prisma migrate deploy) on the test DATABASE_URL
 *  - ⚠️ Use a separate test DB — the test creates and deletes real users and tasks
 *
 * The Expo Push API is NOT called — global.fetch is mocked. This tests our
 * infrastructure (queue → worker → log), not the Expo network.
 *
 * Contract verified here (ADR-009 post-0011A):
 *  - Job payload contains taskId + userId + scheduledFor, no taskTitle (privacy).
 *  - DeviceToken model is used for fan-out; legacy expoPushToken is fallback only.
 *  - Per-device delivery outcome recorded in NotificationLog with deviceTokenId.
 *  - Dedup: same jobId does not trigger two deliveries.
 *  - DeviceNotRegistered revokes only the affected device token row.
 *
 * Run: cd apps/api && npm run test:e2e
 *   (or: npx jest --config ./test/jest-e2e.json notification-reliability)
 *
 * NOT VERIFIED in environments without Redis/PostgreSQL — see docs/Backend.md.
 *
 * Infrastructure failure behaviour (Task 0011I):
 *   A TCP preflight checks Redis (:6379) and PostgreSQL (:5432) before loading
 *   any NestJS modules. If either port is unreachable within 2 s, beforeAll
 *   throws a clear error and Jest marks every test in the suite as failed
 *   (non-zero exit) without ever starting the BullMQ connection retry loop that
 *   would otherwise hang the process indefinitely. afterAll is null-safe and
 *   only cleans up resources that were successfully initialised.
 */
import * as net from 'net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TASK_REMINDERS_QUEUE } from '../src/notifications/notifications.constants';

/**
 * Attempt a TCP connection to host:port within timeoutMs.
 * Resolves on success, rejects on failure/timeout with a clear message.
 * Used as an infrastructure preflight before loading NestJS modules.
 */
function checkTcpPort(host: string, port: number, label: string, timeoutMs = 2_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const cleanup = (err?: Error) => {
      socket.destroy();
      if (err) {
        reject(new Error(`E2E preflight: ${label} unreachable — ${err.message}`));
      } else {
        resolve();
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cleanup());
    socket.once('error', (err) => cleanup(err));
    socket.once('timeout', () => cleanup(new Error(`connection timed out after ${timeoutMs}ms`)));
    socket.connect(port, host);
  });
}

describe('Notification Reliability (e2e)', () => {
  let app!: INestApplication;
  let prisma!: PrismaService;
  let queue!: Queue;
  let userId!: string;
  let deviceTokenId!: string;
  // True only when app.init() has completed successfully. Used by afterAll to
  // skip teardown when bootstrap failed and nothing was actually initialised.
  let appInitialized = false;

  beforeAll(async () => {
    // ── Preflight: check required services before loading any NestJS modules ──
    // BullMQ opens a Redis connection the moment the module is compiled. If Redis
    // is down that connection enters an infinite retry loop and Jest hangs. The
    // TCP probe below fails in <2 s so the suite exits cleanly without ever
    // creating the problematic connection.
    await checkTcpPort('localhost', 6379, 'Redis :6379');
    await checkTcpPort('localhost', 5432, 'PostgreSQL :5432');

    // ── Application bootstrap ─────────────────────────────────────────────────
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    appInitialized = true;

    prisma = app.get(PrismaService);
    queue = app.get(getQueueToken(TASK_REMINDERS_QUEUE));

    // Mock Expo Push API — we test infra, not the Expo network.
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: { status: 'ok' } }),
    }) as any;

    // Create test user WITHOUT legacy expoPushToken — tests the DeviceToken path.
    const user = await prisma.user.create({
      data: {
        email: `e2e-notif-${Date.now()}@test.local`,
        passwordHash: 'test-hash-not-real',
        // expoPushToken intentionally omitted — DeviceToken is the source of truth.
      },
    });
    userId = user.id;

    // Register a DeviceToken for this user (as the mobile client would).
    const dt = await prisma.deviceToken.create({
      data: {
        userId,
        token: `ExponentPushToken[e2e-device-${userId}]`,
        platform: 'expo',
      },
    });
    deviceTokenId = dt.id;
  }, 30_000);

  afterAll(async () => {
    // Nothing to clean up when beforeAll did not complete successfully.
    if (!appInitialized) return;

    await prisma.notificationLog.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.task.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.deviceToken.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await queue.close().catch(() => {});
    await app.close().catch(() => {});
  });

  it('delivers reminder from task creation to NotificationLog (DeviceToken path)', async () => {
    const startTime = new Date(Date.now() + 2_000);

    const task = await prisma.task.create({
      data: { userId, title: 'E2E Notification Task', startTime, durationMinutes: 15 },
    });

    // Job payload must NOT contain taskTitle (ADR-009 privacy contract).
    const jobPayload = {
      taskId: task.id,
      userId,
      scheduledFor: startTime.toISOString(),
      // taskTitle intentionally absent
    };

    await queue.add(
      'task-reminder',
      jobPayload,
      { jobId: `task-reminder-${task.id}`, delay: startTime.getTime() - Date.now(), attempts: 3 },
    );

    // Wait for the worker to process the job (delay + processing margin).
    await new Promise((resolve) => setTimeout(resolve, 4_000));

    const log = await prisma.notificationLog.findFirst({
      where: { taskId: task.id },
      orderBy: { sentAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.delivered).toBe(true);
    // Per-device tracking: deviceTokenId recorded in log (ADR-009 D-5 fix).
    expect(log?.deviceTokenId).toBe(deviceTokenId);

    // Expo Push API was called with generic payload (no taskTitle, no userId).
    const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(fetchBody).not.toHaveProperty('taskTitle');
    expect(fetchBody).not.toHaveProperty('userId');
    expect(fetchBody.data).not.toHaveProperty('taskId');
    expect(fetchBody.title).toBe('Focus');
  }, 15_000);

  it('idempotency: duplicate jobId does not trigger double delivery', async () => {
    const startTime = new Date(Date.now() + 2_000);

    const task = await prisma.task.create({
      data: { userId, title: 'E2E Dedup Task', startTime, durationMinutes: 15 },
    });

    const jobPayload = {
      taskId: task.id,
      userId,
      scheduledFor: startTime.toISOString(),
    };
    const opts = {
      jobId: `task-reminder-${task.id}`,
      delay: startTime.getTime() - Date.now(),
      attempts: 3,
    };

    // BullMQ dedup: same jobId → second add is a no-op.
    await queue.add('task-reminder', jobPayload, opts);
    await queue.add('task-reminder', jobPayload, opts);

    await new Promise((resolve) => setTimeout(resolve, 4_000));

    const logs = await prisma.notificationLog.findMany({
      where: { taskId: task.id, delivered: true },
    });
    // At most one delivery despite two enqueue attempts.
    expect(logs.length).toBeLessThanOrEqual(1);
  }, 15_000);

  it('DeviceNotRegistered revokes only the affected device token', async () => {
    const startTime = new Date(Date.now() + 2_000);

    // Add a second device that will be DeviceNotRegistered.
    const deadDevice = await prisma.deviceToken.create({
      data: {
        userId,
        token: `ExponentPushToken[e2e-dead-${Date.now()}]`,
        platform: 'expo',
      },
    });

    // Mock: first call succeeds (live device), second call returns DeviceNotRegistered.
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ data: { status: 'ok' } }) })
      .mockResolvedValueOnce({
        json: async () => ({
          data: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        }),
      });

    const task = await prisma.task.create({
      data: { userId, title: 'E2E Revoke Task', startTime, durationMinutes: 15 },
    });

    await queue.add(
      'task-reminder',
      { taskId: task.id, userId, scheduledFor: startTime.toISOString() },
      { jobId: `task-reminder-${task.id}`, delay: startTime.getTime() - Date.now(), attempts: 3 },
    );

    await new Promise((resolve) => setTimeout(resolve, 4_000));

    // The dead device should be revoked.
    const revokedToken = await prisma.deviceToken.findUnique({
      where: { id: deadDevice.id },
    });
    expect(revokedToken?.revokedAt).not.toBeNull();

    // The live device should still be active.
    const liveToken = await prisma.deviceToken.findUnique({
      where: { id: deviceTokenId },
    });
    expect(liveToken?.revokedAt).toBeNull();

    // Clean up dead device.
    await prisma.deviceToken.delete({ where: { id: deadDevice.id } });
  }, 15_000);
});
