/**
 * Authenticated Recovery integration tests (Task 0007A F4, corrected in 0007B).
 *
 * Real components under test:
 *   JwtAuthGuard → JwtStrategy → TasksController → TaskRecoveryService
 * Only PrismaService and NotificationsService are mocked (in-process fakes;
 * no database or Redis required).
 *
 * Why the Prisma user mock dispatches BY REQUESTED ID (0007B finding 1):
 * the previous version returned the same user for every JWT subject, so it
 * could not prove that identity is derived from `payload.sub`. Now user A,
 * user B, and unknown IDs each resolve differently, and the two users have
 * DIFFERENT timezones so the response body itself reveals which identity the
 * request was evaluated as.
 *
 * Identity is asserted at two observable boundaries (0007B finding 2):
 *   1. the `prisma.user.findUnique({ where: { id } })` lookup performed by the
 *      real JwtStrategy from `payload.sub`;
 *   2. the `userId` embedded in the real service's conditional `updateMany`
 *      where-clause — i.e. the identity that actually gates the write.
 *
 * Verified behaviors:
 *  1. Unauthenticated requests are rejected (401).
 *  2. Invalid signature is rejected (401).
 *  3. Unknown JWT subject is rejected (401).
 *  4. JWT subject → user identity mapping (user A token ≠ user B token).
 *  5. Ownership across two users, both directions.
 *  6. Mixed-ownership batch rejected atomically (403, no write).
 *  7. Valid reschedule succeeds through the real path (200).
 *  8. Reminder queue failure still commits (200, reminderSyncStatus: partial).
 *
 * NOT covered here: the PostgreSQL/Redis-backed e2e spec
 * (apps/api/test/notification-reliability.e2e-spec.ts) cannot run in this
 * environment — see docs/Backend.md.
 */

import supertest = require('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

const TEST_SECRET = 'integration-test-secret-7A';

/**
 * Two distinct users with DIFFERENT timezones. The timezone difference makes
 * the resolved identity observable in the response body of GET /tasks/recovery.
 */
const USER_A = {
  id: 'user-auth-integration-A',
  email: 'user-a@test.local',
  timezone: 'Europe/Moscow', // UTC+3
  passwordHash: 'test-hash-a',
  expoPushToken: null,
  plan: 'FREE' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const USER_B = {
  id: 'user-auth-integration-B',
  email: 'user-b@test.local',
  timezone: 'America/New_York', // UTC-4/-5 — deliberately different from A
  passwordHash: 'test-hash-b',
  expoPushToken: null,
  plan: 'FREE' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const UNKNOWN_USER_ID = 'user-does-not-exist-in-db';

const TASK_OF_A = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const TASK_OF_B = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';

function makeFutureISO(offsetMs = 60 * 60 * 1000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/** Overdue ownership row shape used by the service's batch ownership check. */
function ownershipRow(taskId: string, ownerId: string) {
  return {
    id: taskId,
    userId: ownerId,
    completedAt: null,
    startTime: new Date('2026-01-02T10:00:00.000Z'), // long past → overdue
    isRecurring: false,
    parentTaskId: null,
  };
}

describe('Recovery routes — authenticated integration (real guard + strategy + service)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let mockPrisma: {
    user: { findUnique: jest.Mock };
    task: { findMany: jest.Mock; updateMany: jest.Mock };
    recoveryUndo: { create: jest.Mock };
    recoveryUndoItem: { createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let mockNotifications: {
    scheduleTaskReminder: jest.Mock;
    cancelTaskReminder: jest.Mock;
  };

  function signToken(userId: string): string {
    return jwtService.sign({ sub: userId });
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  /** userId values seen by the real service's conditional write. */
  function updateManyUserIds(): unknown[] {
    return mockPrisma.task.updateMany.mock.calls.map((c) => c[0]?.where?.userId);
  }

  /** IDs the real JwtStrategy asked Prisma to resolve from `payload.sub`. */
  function userLookupIds(): unknown[] {
    return mockPrisma.user.findUnique.mock.calls.map((c) => c[0]?.where?.id);
  }

  beforeAll(async () => {
    mockPrisma = {
      user: { findUnique: jest.fn() },
      task: { findMany: jest.fn(), updateMany: jest.fn() },
      recoveryUndo: { create: jest.fn(({ data }) => ({ id: 'undo-auth', ...data })) },
      recoveryUndoItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(),
    };

    mockNotifications = {
      scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
      cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [TasksController],
      providers: [
        // Real service under test
        TaskRecoveryService,
        // Required by TasksController, not under test here
        {
          provide: TasksService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            update: jest.fn(),
            toggleComplete: jest.fn(),
            remove: jest.fn(),
          },
        },
        // Real auth strategy — reads the same validated configuration source as AuthService
        JwtStrategy,
        // Mocked infrastructure only
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { getOrThrow: () => TEST_SECRET } },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // resetAllMocks clears both call history AND queued mockResolvedValueOnce
    // implementations (unlike clearAllMocks which only clears call history).
    // This prevents unconsumed queued values from leaking into later tests —
    // the root cause of the partial-reminder test returning "ok" when the
    // body-rejection test left queued values behind (Task 0007C finding 2-3).
    jest.resetAllMocks();

    // Restore the default implementations needed by every test.
    mockNotifications.scheduleTaskReminder.mockResolvedValue(undefined);
    mockNotifications.cancelTaskReminder.mockResolvedValue(undefined);
    mockPrisma.recoveryUndo.create.mockImplementation(async ({ data }: any) => ({ id: 'undo-auth', ...data }));
    mockPrisma.recoveryUndoItem.createMany.mockResolvedValue({ count: 1 });

    // Resolve users BY REQUESTED ID. Unknown ids resolve to null so the real
    // JwtStrategy throws UnauthorizedException, exactly as in production.
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      const id = args?.where?.id;
      if (id === USER_A.id) return USER_A;
      if (id === USER_B.id) return USER_B;
      return null;
    });
  });

  // ── 1. Unauthenticated / invalid-token rejection ──────────────────────────

  it('GET /tasks/recovery — no token → 401', async () => {
    await supertest(app.getHttpServer()).get('/tasks/recovery').expect(401);
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });

  it('POST /tasks/recovery/reschedule — no token → 401', async () => {
    await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .send({ items: [{ taskId: TASK_OF_A, targetStartTime: null }] })
      .expect(401);

    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('invalid signature (token signed with a different secret) → 401', async () => {
    const wrongService = new JwtService({ secret: 'wrong-secret' });
    const badToken = wrongService.sign({ sub: USER_A.id });

    await supertest(app.getHttpServer())
      .get('/tasks/recovery')
      .set(authHeader(badToken))
      .expect(401);

    // Signature is rejected before any user lookup happens.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });

  it('valid signature but unknown subject → 401 (strategy resolves null)', async () => {
    const token = signToken(UNKNOWN_USER_ID);

    await supertest(app.getHttpServer())
      .get('/tasks/recovery')
      .set(authHeader(token))
      .expect(401);

    // The strategy DID look the subject up, and got null → rejected.
    expect(userLookupIds()).toContain(UNKNOWN_USER_ID);
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });

  // ── 2. JWT subject → identity mapping (0007B core evidence) ───────────────

  it('user A token is evaluated as user A (lookup id + response timezone)', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const res = await supertest(app.getHttpServer())
      .get('/tasks/recovery')
      .set(authHeader(signToken(USER_A.id)))
      .expect(200);

    // Identity boundary 1: the strategy resolved payload.sub === USER_A.id
    expect(userLookupIds()).toContain(USER_A.id);
    expect(userLookupIds()).not.toContain(USER_B.id);
    // Identity boundary 2: the service used user A's timezone, not B's
    expect(res.body.userTimezone).toBe(USER_A.timezone);
    expect(res.body.userTimezone).not.toBe(USER_B.timezone);
  });

  it('user B token is evaluated as user B, NOT as user A', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const res = await supertest(app.getHttpServer())
      .get('/tasks/recovery')
      .set(authHeader(signToken(USER_B.id)))
      .expect(200);

    // Proves the identity comes from this token's subject, not from a fixture.
    expect(userLookupIds()).toContain(USER_B.id);
    expect(userLookupIds()).not.toContain(USER_A.id);
    expect(res.body.userTimezone).toBe(USER_B.timezone);
    expect(res.body.userTimezone).not.toBe(USER_A.timezone);
  });

  it('two different tokens in sequence resolve to two different identities', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);

    const resA = await supertest(app.getHttpServer())
      .get('/tasks/recovery')
      .set(authHeader(signToken(USER_A.id)))
      .expect(200);

    const resB = await supertest(app.getHttpServer())
      .get('/tasks/recovery')
      .set(authHeader(signToken(USER_B.id)))
      .expect(200);

    // Same route, same process, different subjects → different resolved users.
    expect(resA.body.userTimezone).toBe(USER_A.timezone);
    expect(resB.body.userTimezone).toBe(USER_B.timezone);
    expect(resA.body.userTimezone).not.toBe(resB.body.userTimezone);
  });

  // ── 3. Ownership across two users — both directions ───────────────────────

  it("user B's token is REJECTED for a task owned by user A (403, no write)", async () => {
    // The batch ownership query returns a row owned by A while the caller is B.
    mockPrisma.task.findMany.mockResolvedValue([ownershipRow(TASK_OF_A, USER_A.id)]);

    await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_B.id)))
      .send({ items: [{ taskId: TASK_OF_A, targetStartTime: null }] })
      .expect(403);

    // Identity used for the decision was B (that is why A's task is foreign).
    expect(userLookupIds()).toContain(USER_B.id);
    // Rejected BEFORE any transaction or write.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  it("user A's token is REJECTED for a task owned by user B (403, no write)", async () => {
    mockPrisma.task.findMany.mockResolvedValue([ownershipRow(TASK_OF_B, USER_B.id)]);

    await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_A.id)))
      .send({ items: [{ taskId: TASK_OF_B, targetStartTime: null }] })
      .expect(403);

    expect(userLookupIds()).toContain(USER_A.id);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  it("user B CAN process a task owned by user B (200, write gated by B's id)", async () => {
    const row = ownershipRow(TASK_OF_B, USER_B.id);
    mockPrisma.task.findMany
      .mockResolvedValueOnce([row]) // ownership check
      .mockResolvedValueOnce([{ ...row, startTime: null }]); // post-commit reload
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
      return fn(mockPrisma);
    });

    const res = await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_B.id)))
      .send({ items: [{ taskId: TASK_OF_B, targetStartTime: null }] })
      .expect(200);

    expect(res.body.taskUpdateStatus).toBe('ok');

    // THE key identity assertion: the conditional write was gated by B's id,
    // taken from the JWT — not by A's id and not from the request body.
    expect(updateManyUserIds()).toEqual([USER_B.id]);
    expect(updateManyUserIds()).not.toContain(USER_A.id);
  });

  it("user A CAN process a task owned by user A (200, write gated by A's id)", async () => {
    const row = ownershipRow(TASK_OF_A, USER_A.id);
    mockPrisma.task.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ ...row, startTime: null }]);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
      return fn(mockPrisma);
    });

    await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_A.id)))
      .send({ items: [{ taskId: TASK_OF_A, targetStartTime: null }] })
      .expect(200);

    expect(updateManyUserIds()).toEqual([USER_A.id]);
    expect(updateManyUserIds()).not.toContain(USER_B.id);
  });

  it('userId in the request body cannot override the JWT identity', async () => {
    // The request is rejected at the HTTP boundary by forbidNonWhitelisted
    // (ValidationPipe) before the service runs. No service mock setup needed —
    // adding unconsumed mockResolvedValueOnce values here was the root cause of
    // the partial-reminder test leak (Task 0007C finding 3).
    await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_A.id)))
      .send({
        userId: USER_B.id,
        items: [{ taskId: TASK_OF_A, targetStartTime: null }],
      })
      .expect(400);

    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  // ── 4. Mixed-ownership batch — atomic rejection ───────────────────────────

  it('mixed batch (own + foreign task) → 403, no partial write', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      ownershipRow(TASK_OF_A, USER_A.id), // caller owns this
      ownershipRow(TASK_OF_B, USER_B.id), // caller does NOT own this
    ]);

    await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_A.id)))
      .send({
        items: [
          { taskId: TASK_OF_A, targetStartTime: null },
          { taskId: TASK_OF_B, targetStartTime: null },
        ],
      })
      .expect(403);

    // Whole batch rejected — the owned task was NOT written either.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
  });

  // ── 5. Valid dated reschedule through the real path ───────────────────────

  it('valid future dated destination → 200 through the real guard/service path', async () => {
    const row = ownershipRow(TASK_OF_A, USER_A.id);
    const future = makeFutureISO();
    mockPrisma.task.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ ...row, startTime: new Date(future) }]);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
      return fn(mockPrisma);
    });

    const res = await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_A.id)))
      .send({ items: [{ taskId: TASK_OF_A, targetStartTime: future }] })
      .expect(200);

    expect(res.body.taskUpdateStatus).toBe('ok');
    expect(res.body.reminderSyncStatus).toBe('ok');
    expect(updateManyUserIds()).toEqual([USER_A.id]);
    expect(mockNotifications.scheduleTaskReminder).toHaveBeenCalledTimes(1);
  });

  // ── 6. Reminder queue failure still commits ───────────────────────────────

  it('queue failure after commit → 200 with reminderSyncStatus: partial', async () => {
    const row = ownershipRow(TASK_OF_A, USER_A.id);
    mockPrisma.task.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ ...row, startTime: null }]);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
      return fn(mockPrisma);
    });
    mockNotifications.cancelTaskReminder.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    const res = await supertest(app.getHttpServer())
      .post('/tasks/recovery/reschedule')
      .set(authHeader(signToken(USER_A.id)))
      .send({ items: [{ taskId: TASK_OF_A, targetStartTime: null }] })
      .expect(200); // the task move committed — this is NOT an HTTP error

    expect(res.body.taskUpdateStatus).toBe('ok');
    expect(res.body.reminderSyncStatus).toBe('partial');
    expect(res.body.failedReminderSyncs).toContain(TASK_OF_A);
  });
});
