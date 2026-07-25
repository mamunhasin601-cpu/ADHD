/**
 * Интеграционный тест полного пути:
 * создание задачи → постановка в очередь BullMQ → фактическая отправка → запись в NotificationLog.
 *
 * ТРЕБУЕТ:
 *  - поднятых Redis и PostgreSQL (docker compose up -d)
 *  - применённых миграций на ту БД, на которую указывает DATABASE_URL в .env
 *  - ⚠️ используйте отдельную тестовую БД, не прод и не основную dev-БД — тест
 *    создаёт и удаляет реального пользователя и его задачи
 *
 * Expo Push API по-настоящему не дёргается — global.fetch замокан, проверяется
 * именно наша инфраструктура (очередь → воркер → запись в лог), а не сеть Expo.
 *
 * Запуск: cd apps/api && npm run test:e2e
 * (или npx jest --config ./test/jest-e2e.json notification-reliability)
 *
 * Тест использует настоящие таймеры и реальный delay в очереди — выполняется
 * несколько секунд, это ожидаемо для интеграционного теста такого рода.
 */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TASK_REMINDERS_QUEUE } from '../src/notifications/notifications.constants';

describe('Надёжность доставки уведомлений (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queue: Queue;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    queue = app.get(getQueueToken(TASK_REMINDERS_QUEUE));

    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: { status: 'ok' } }),
    }) as any;

    const user = await prisma.user.create({
      data: {
        email: `e2e-notifications-${Date.now()}@test.local`,
        passwordHash: 'test-hash-not-real',
        expoPushToken: 'ExponentPushToken[e2e-test]',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.notificationLog.deleteMany({ where: { userId } });
    await prisma.task.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await queue.close();
    await app.close();
  });

  it('доводит напоминание от создания задачи до записи в NotificationLog', async () => {
    const startTime = new Date(Date.now() + 2_000); // минимальный реалистичный delay

    const task = await prisma.task.create({
      data: { userId, title: 'E2E задача', startTime, durationMinutes: 15 },
    });

    // Имитируем то, что делает TasksService.create() — ставим джобу напрямую в очередь
    await queue.add(
      'task-reminder',
      { taskId: task.id, userId, taskTitle: task.title, scheduledFor: startTime.toISOString() },
      { jobId: `task-reminder-${task.id}`, delay: startTime.getTime() - Date.now(), attempts: 3 },
    );

    // Ждём, пока воркер реально обработает джобу (delay + запас на обработку)
    await new Promise((resolve) => setTimeout(resolve, 4_000));

    const log = await prisma.notificationLog.findFirst({
      where: { taskId: task.id },
      orderBy: { sentAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.delivered).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.any(Object),
    );
  }, 15_000);

  it('идемпотентность: повторная постановка джобы с тем же jobId не даёт двойную отправку', async () => {
    const startTime = new Date(Date.now() + 2_000);
    const task = await prisma.task.create({
      data: { userId, title: 'E2E задача — retry', startTime, durationMinutes: 15 },
    });

    const jobPayload = {
      taskId: task.id,
      userId,
      taskTitle: task.title,
      scheduledFor: startTime.toISOString(),
    };
    const opts = {
      jobId: `task-reminder-${task.id}`,
      delay: startTime.getTime() - Date.now(),
      attempts: 3,
    };

    await queue.add('task-reminder', jobPayload, opts);
    // Повторная постановка с тем же jobId — так ведёт себя TasksService при повторном
    // update() той же задачи; BullMQ не должен породить вторую фактическую отправку
    await queue.add('task-reminder', jobPayload, opts);

    await new Promise((resolve) => setTimeout(resolve, 4_000));

    const logs = await prisma.notificationLog.findMany({
      where: { taskId: task.id, delivered: true },
    });
    expect(logs.length).toBe(1);
  }, 15_000);
});
