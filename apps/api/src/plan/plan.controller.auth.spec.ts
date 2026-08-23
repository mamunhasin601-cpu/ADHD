import supertest = require('supertest');
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const users: Record<string, any> = {
  a: { id: 'a', email: 'a@example.test', passwordHash: 'hash', timezone: 'UTC', plan: 'FREE', proExpiresAt: null },
  b: { id: 'b', email: 'b@example.test', passwordHash: 'hash', timezone: 'UTC', plan: 'PRO', proExpiresAt: null },
};

describe('PlanController entitlement boundary', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let update: jest.Mock;
  let log: jest.SpyInstance;
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ENABLE_DEV_PLAN_MUTATIONS;

  beforeAll(async () => {
    update = jest.fn(async ({ where, data }) => Object.assign(users[where.id], data));
    const prisma = {
      user: {
        findUnique: jest.fn(async ({ where, select }) => {
          const user = users[where.id] ?? null;
          if (!user || !select) return user;
          return Object.fromEntries(Object.keys(select).map((key) => [key, user[key]]));
        }),
        update,
      },
      task: { count: jest.fn(async () => 12) },
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'plan-boundary-test-secret' })],
      controllers: [PlanController],
      providers: [
        PlanService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { getOrThrow: () => 'plan-boundary-test-secret' } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    jwt = module.get(JwtService);
  });

  beforeEach(() => {
    users.a.plan = 'FREE';
    users.a.proExpiresAt = null;
    users.b.plan = 'PRO';
    users.b.proExpiresAt = null;
    update.mockClear();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    delete process.env.ENABLE_DEV_PLAN_MUTATIONS;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => log.mockRestore());

  afterAll(async () => {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    if (originalFlag === undefined) delete process.env.ENABLE_DEV_PLAN_MUTATIONS;
    else process.env.ENABLE_DEV_PLAN_MUTATIONS = originalFlag;
    await app.close();
  });

  const token = (id: string) => jwt.sign({ sub: id });
  const auth = (id: string) => ({ Authorization: `Bearer ${token(id)}` });

  it('keeps authenticated GET /plan response compatible', async () => {
    const response = await supertest(app.getHttpServer()).get('/plan').set(auth('a')).expect(200);
    expect(response.body).toEqual({
      plan: 'FREE', isPro: false, proExpiresAt: null,
      usage: { activeTasks: 12, limit: 50 },
    });
  });

  it('rejects unauthenticated mutation without changing either user', async () => {
    await supertest(app.getHttpServer()).post('/plan/upgrade').expect(401);
    expect(update).not.toHaveBeenCalled();
    expect(users.a.plan).toBe('FREE');
    expect(users.b.plan).toBe('PRO');
  });

  it('fails closed in production even when the flag is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_PLAN_MUTATIONS = 'true';
    await supertest(app.getHttpServer()).post('/plan/upgrade').set(auth('a')).expect(404);
    expect(update).not.toHaveBeenCalled();
    expect(users.a.plan).toBe('FREE');
  });

  it.each([undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true '])(
    'fails closed outside production for flag value %p',
    async (flag) => {
      if (flag === undefined) delete process.env.ENABLE_DEV_PLAN_MUTATIONS;
      else process.env.ENABLE_DEV_PLAN_MUTATIONS = flag;
      await supertest(app.getHttpServer()).post('/plan/upgrade').set(auth('a')).expect(404);
      expect(update).not.toHaveBeenCalled();
      expect(users.a.plan).toBe('FREE');
    },
  );

  it('allows enabled non-production upgrade for only the authenticated owner and emits a safe audit event', async () => {
    process.env.ENABLE_DEV_PLAN_MUTATIONS = 'true';
    await supertest(app.getHttpServer()).post('/plan/upgrade').set(auth('a')).expect(200);
    expect(users.a.plan).toBe('PRO');
    expect(users.b.plan).toBe('PRO');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a' } }));
    const event = JSON.parse(log.mock.calls[0][0]);
    expect(event).toEqual({ event: 'development_plan_mutation', actorUserId: 'a', targetPlan: 'PRO' });
    expect(log.mock.calls[0][0]).not.toMatch(/email|phone|token|payment|hash/i);
  });

  it('upgrade and rapid repeated calls cannot change another user', async () => {
    process.env.ENABLE_DEV_PLAN_MUTATIONS = 'true';
    for (let call = 0; call < 4; call += 1) {
      await supertest(app.getHttpServer()).post('/plan/upgrade').set(auth('a')).expect(200);
    }
    expect(users.a.plan).toBe('PRO');
    expect(users.b.plan).toBe('PRO');
    expect(update.mock.calls.every(([arg]) => arg.where.id === 'a')).toBe(true);
  });

  it('downgrade can change only the authenticated owner', async () => {
    process.env.ENABLE_DEV_PLAN_MUTATIONS = 'true';
    await supertest(app.getHttpServer()).post('/plan/downgrade').set(auth('b')).expect(200);
    expect(users.a.plan).toBe('FREE');
    expect(users.b.plan).toBe('FREE');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b' } }));
  });
});
