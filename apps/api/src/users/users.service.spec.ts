import { UsersService } from './users.service';

describe('UsersService profile persistence', () => {
  const base = {
    id: 'u1',
    email: 'u@test.dev',
    phone: null,
    passwordHash: 'secret',
    timezone: 'Europe/Moscow',
    timezoneSyncedAt: new Date('2026-09-01T00:00:00Z'),
    timeFormat: 'SYSTEM',
    hasCompletedOnboarding: true,
    plan: 'FREE',
    proExpiresAt: null,
    expoPushToken: null,
    yandexId: null,
    vkId: null,
    mailruId: null,
    createdAt: new Date(),
  };
  let current: any;
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    current = { ...base };
    const user = {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(current)),
      update: jest.fn().mockImplementation(({ data }) => {
        current = { ...current, ...data };
        return Promise.resolve(current);
      }),
      delete: jest.fn(),
    };
    const task = { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() };
    prisma = { user, task };
    prisma.$transaction = jest.fn((callback) => callback(prisma));
    service = new UsersService(prisma, {
      scheduleTaskReminder: jest.fn(),
      cancelTaskReminder: jest.fn(),
    } as any);
  });

  it.each(['SYSTEM', 'H24', 'H12'] as const)(
    'passes %s unchanged to Prisma and returns it',
    async (timeFormat) => {
      const result = await service.update('u1', { timeFormat } as any);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { timeFormat },
      });
      expect(result.timeFormat).toBe(timeFormat);
      expect(result).not.toHaveProperty('passwordHash');
    },
  );

  it('routes a timezone-only update through the smartphone sync contract', async () => {
    await service.update('u1', { timezone: 'Asia/Tokyo' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(current).toMatchObject({ timezone: 'Asia/Tokyo', timezoneSyncedAt: expect.any(Date) });
  });

  it('does not overwrite timezone in a timeFormat-only update', async () => {
    await service.update('u1', { timeFormat: 'H12' } as any);
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('timezone');
  });

  it('safe response includes profile preferences and excludes passwordHash', async () => {
    const result = await service.update('u1', { timeFormat: 'H24' } as any);
    expect(result).toMatchObject({ timeFormat: 'H24', timezone: 'Europe/Moscow' });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
