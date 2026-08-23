/**
 * Authenticated NotificationsController integration tests (Task 0011A finding 11).
 *
 * Real components under test:
 *   JwtAuthGuard → JwtStrategy → NotificationsController → NotificationsService
 * Only PrismaService is mocked (in-process fake; no database or Redis required).
 *
 * Verified behaviors:
 *  1. Unauthenticated requests are rejected (401).
 *  2. Invalid signature is rejected (401).
 *  3. Unknown JWT subject is rejected (401).
 *  4. User A can register a new device token (201).
 *  5. Same user re-registering same active token is idempotent (201, no duplicate write).
 *  6. Same user can restore their own revoked token (201).
 *  7. User A cannot register User B's active token (409 ConflictException).
 *  8. User A cannot delete User B's token (404).
 *  9. User A can delete their own token (204).
 * 10. Unknown fields in request body are rejected (400) by ValidationPipe.
 * 11. Invalid token format is rejected (400).
 * 12. Invalid platform value is rejected (400).
 *
 * NOT covered here: Redis/PostgreSQL-backed e2e (requires live infrastructure).
 */

import supertest = require('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ConflictException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ExternalHttpService } from '../external-http/external-http.service';

const TEST_SECRET = 'notif-auth-integration-test-secret';

const USER_A = {
  id: 'notif-user-A',
  email: 'user-a@notif.test',
  timezone: 'Europe/Moscow',
  passwordHash: 'hash-a',
  expoPushToken: null,
  plan: 'FREE' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const USER_B = {
  id: 'notif-user-B',
  email: 'user-b@notif.test',
  timezone: 'America/New_York',
  passwordHash: 'hash-b',
  expoPushToken: null,
  plan: 'FREE' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const UNKNOWN_USER_ID = 'notif-user-does-not-exist';

/** Valid Expo push token values used in tests. */
const TOKEN_A = 'ExponentPushToken[aaaa-device-A]';
const TOKEN_B = 'ExponentPushToken[bbbb-device-B]';
const TOKEN_ID_A = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const TOKEN_ID_B = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';

describe('NotificationsController — authenticated integration (real guard + strategy)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let mockPrisma: {
    user: { findUnique: jest.Mock };
    deviceToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    notificationLog: { create: jest.Mock; findFirst: jest.Mock };
  };

  function signToken(userId: string): string {
    return jwtService.sign({ sub: userId });
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    mockPrisma = {
      user: { findUnique: jest.fn() },
      deviceToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notificationLog: { create: jest.fn(), findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [NotificationsController],
      providers: [
        // Real service under test (no BullMQ queue needed for token endpoints)
        {
          provide: 'BullQueue_task-reminders',
          useValue: { add: jest.fn(), getJob: jest.fn().mockResolvedValue(null) },
        },
        NotificationsService,
        JwtStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExternalHttpService, useValue: { requestJson: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: () => TEST_SECRET } },
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
    jest.resetAllMocks();

    // Resolve users by requested ID. Unknown IDs resolve to null.
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      const id = args?.where?.id;
      if (id === USER_A.id) return USER_A;
      if (id === USER_B.id) return USER_B;
      return null;
    });

    // Default: no existing device token
    mockPrisma.deviceToken.findUnique.mockResolvedValue(null);
    mockPrisma.deviceToken.create.mockResolvedValue({
      id: TOKEN_ID_A,
      token: TOKEN_A,
      platform: 'expo',
      userId: USER_A.id,
      revokedAt: null,
    });
    mockPrisma.deviceToken.update.mockResolvedValue({});
  });

  // ── 1. Unauthenticated / invalid-token rejection ──────────────────────────

  it('POST /notifications/devices — no token → 401', async () => {
    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .send({ token: TOKEN_A })
      .expect(401);

    expect(mockPrisma.deviceToken.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  it('DELETE /notifications/devices/:id — no token → 401', async () => {
    await supertest(app.getHttpServer())
      .delete(`/notifications/devices/${TOKEN_ID_A}`)
      .expect(401);

    expect(mockPrisma.deviceToken.findUnique).not.toHaveBeenCalled();
  });

  it('invalid JWT signature → 401', async () => {
    const wrongService = new JwtService({ secret: 'wrong-secret' });
    const badToken = wrongService.sign({ sub: USER_A.id });

    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(badToken))
      .send({ token: TOKEN_A })
      .expect(401);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('valid signature but unknown subject → 401', async () => {
    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(UNKNOWN_USER_ID)))
      .send({ token: TOKEN_A })
      .expect(401);

    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  // ── 2. Register new token ─────────────────────────────────────────────────

  it('user A can register a new device token (201)', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_A, platform: 'expo' })
      .expect(201);

    // Response must NOT return the token value (privacy)
    expect(res.body).not.toHaveProperty('token');
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('platform');

    expect(mockPrisma.deviceToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_A.id }),
      }),
    );
  });

  // ── 3. Idempotent re-registration (same user, same active token) ───────────

  it('same user re-registering active token returns existing record (201, no create)', async () => {
    mockPrisma.deviceToken.findUnique.mockResolvedValue({
      id: TOKEN_ID_A,
      token: TOKEN_A,
      userId: USER_A.id,
      platform: 'expo',
      revokedAt: null,
      label: null,
      createdAt: new Date(),
    });

    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_A })
      .expect(201);

    // Idempotent — no new row created for an already-active token.
    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  // ── 4. Restore revoked token ──────────────────────────────────────────────

  it('same user can restore their own revoked token (201, revokedAt cleared)', async () => {
    mockPrisma.deviceToken.findUnique.mockResolvedValue({
      id: TOKEN_ID_A,
      token: TOKEN_A,
      userId: USER_A.id,
      platform: 'expo',
      revokedAt: new Date('2026-07-01'),
      label: null,
      createdAt: new Date(),
    });
    mockPrisma.deviceToken.update.mockResolvedValue({
      id: TOKEN_ID_A,
      token: TOKEN_A,
      platform: 'expo',
      revokedAt: null,
    });

    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_A })
      .expect(201);

    expect(mockPrisma.deviceToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TOKEN_ID_A },
        data: expect.objectContaining({ revokedAt: null }),
      }),
    );
  });

  // ── 5. Foreign-user token security ───────────────────────────────────────

  it('user A cannot register user B active token → 409', async () => {
    // Token is owned by user B.
    mockPrisma.deviceToken.findUnique.mockResolvedValue({
      id: TOKEN_ID_B,
      token: TOKEN_B,
      userId: USER_B.id,
      platform: 'expo',
      revokedAt: null,
      label: null,
      createdAt: new Date(),
    });

    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_B })
      .expect(409);

    // No write performed.
    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
    expect(mockPrisma.deviceToken.update).not.toHaveBeenCalled();
  });

  // ── 6. Remove token ───────────────────────────────────────────────────────

  it('user A can delete their own token (204)', async () => {
    mockPrisma.deviceToken.findUnique.mockResolvedValue({
      id: TOKEN_ID_A,
      token: TOKEN_A,
      userId: USER_A.id,
    });

    await supertest(app.getHttpServer())
      .delete(`/notifications/devices/${TOKEN_ID_A}`)
      .set(authHeader(signToken(USER_A.id)))
      .expect(204);

    expect(mockPrisma.deviceToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TOKEN_ID_A },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it('user A cannot delete user B token → 404, no write', async () => {
    // Token is owned by user B.
    mockPrisma.deviceToken.findUnique.mockResolvedValue({
      id: TOKEN_ID_B,
      token: TOKEN_B,
      userId: USER_B.id,
    });

    await supertest(app.getHttpServer())
      .delete(`/notifications/devices/${TOKEN_ID_B}`)
      .set(authHeader(signToken(USER_A.id)))
      .expect(404);

    expect(mockPrisma.deviceToken.update).not.toHaveBeenCalled();
  });

  it('deleting non-existent token → 404', async () => {
    mockPrisma.deviceToken.findUnique.mockResolvedValue(null);

    await supertest(app.getHttpServer())
      .delete(`/notifications/devices/${TOKEN_ID_A}`)
      .set(authHeader(signToken(USER_A.id)))
      .expect(404);

    expect(mockPrisma.deviceToken.update).not.toHaveBeenCalled();
  });

  // ── 7. DTO validation ─────────────────────────────────────────────────────

  it('unknown fields in body are rejected (400) — forbidNonWhitelisted', async () => {
    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_A, userId: USER_B.id }) // userId is not in the DTO
      .expect(400);

    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  it('invalid token format is rejected (400)', async () => {
    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: 'not-a-valid-expo-token-!!!@@@' })
      .expect(400);

    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  it('invalid platform value is rejected (400)', async () => {
    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_A, platform: 'windows-phone' }) // not in ['expo','apns','fcm']
      .expect(400);

    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  it('empty token string is rejected (400)', async () => {
    await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: '' })
      .expect(400);

    expect(mockPrisma.deviceToken.create).not.toHaveBeenCalled();
  });

  // ── 8. Two users, two devices — ownership isolation proof ─────────────────

  it('user A and user B can each register their own tokens independently', async () => {
    // First call: user A registers TOKEN_A
    mockPrisma.deviceToken.findUnique.mockResolvedValueOnce(null);
    mockPrisma.deviceToken.create.mockResolvedValueOnce({
      id: TOKEN_ID_A,
      token: TOKEN_A,
      platform: 'expo',
      userId: USER_A.id,
      revokedAt: null,
    });

    const resA = await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_A.id)))
      .send({ token: TOKEN_A, platform: 'apns' })
      .expect(201);

    // Second call: user B registers TOKEN_B
    mockPrisma.deviceToken.findUnique.mockResolvedValueOnce(null);
    mockPrisma.deviceToken.create.mockResolvedValueOnce({
      id: TOKEN_ID_B,
      token: TOKEN_B,
      platform: 'fcm',
      userId: USER_B.id,
      revokedAt: null,
    });

    const resB = await supertest(app.getHttpServer())
      .post('/notifications/devices')
      .set(authHeader(signToken(USER_B.id)))
      .send({ token: TOKEN_B, platform: 'fcm' })
      .expect(201);

    expect(resA.body.id).toBe(TOKEN_ID_A);
    expect(resB.body.id).toBe(TOKEN_ID_B);
    expect(resA.body.id).not.toBe(resB.body.id);

    // Each create called with the correct userId from the JWT, never swapped.
    const createCalls = mockPrisma.deviceToken.create.mock.calls;
    expect(createCalls[0][0].data.userId).toBe(USER_A.id);
    expect(createCalls[1][0].data.userId).toBe(USER_B.id);
  });
});
