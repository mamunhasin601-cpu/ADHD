import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { BCRYPT_ROUNDS, OAUTH_BOOTSTRAP_SECRET_BYTES } from './auth.constants';
import { OAuthProfile, OAuthService } from './oauth.service';

jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomBytes: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const randomBytesMock = randomBytes as unknown as jest.Mock;
const hashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

describe('OAuthService', () => {
  const bootstrapSecret = Buffer.alloc(OAUTH_BOOTSTRAP_SECRET_BYTES, 7);
  const bootstrapHash = '$2b$12$opaque-bootstrap-hash';
  const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
  let prisma: any;
  let authService: any;
  let service: OAuthService;
  let mathRandomSpy: jest.SpyInstance;
  let logSpies: jest.SpyInstance[];

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    authService = { generateTokens: jest.fn().mockReturnValue(tokens) };
    service = new OAuthService(prisma, authService);
    randomBytesMock.mockReturnValue(bootstrapSecret);
    hashMock.mockResolvedValue(bootstrapHash as never);
    mathRandomSpy = jest.spyOn(Math, 'random');
    logSpies = ['log', 'warn', 'error'].map((method) =>
      jest.spyOn(console, method as 'log').mockImplementation(),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['yandex', 'yandexId'],
    ['vk', 'vkId'],
    ['mailru', 'mailruId'],
  ] as const)(
    'creates a new %s user with a CSPRNG bootstrap secret and correct provider ID',
    async (provider, providerIdField) => {
      const profile: OAuthProfile = {
        provider,
        providerId: `${provider}-42`,
        email: `${provider}@example.test`,
      };
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'new-user', ...data }),
      );

      await expect(service.handleOAuthCallback(profile)).resolves.toEqual(tokens);

      expect(randomBytesMock).toHaveBeenCalledTimes(1);
      expect(randomBytesMock).toHaveBeenCalledWith(OAUTH_BOOTSTRAP_SECRET_BYTES);
      expect(OAUTH_BOOTSTRAP_SECRET_BYTES).toBeGreaterThanOrEqual(32);
      expect(hashMock).toHaveBeenCalledWith(
        bootstrapSecret.toString('base64url'),
        BCRYPT_ROUNDS,
      );
      expect(BCRYPT_ROUNDS).toBe(12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: profile.email,
          phone: null,
          passwordHash: bootstrapHash,
          timezone: 'Europe/Moscow',
          [providerIdField]: profile.providerId,
        }),
      });
      expect(mathRandomSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(tokens)).not.toContain(
        bootstrapSecret.toString('base64url'),
      );
      expect(JSON.stringify(tokens)).not.toContain(bootstrapHash);
      logSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    },
  );

  it('returns tokens for an existing provider identity without mutation', async () => {
    const existing = { id: 'existing', passwordHash: 'preserved' };
    prisma.user.findFirst.mockResolvedValueOnce(existing);

    await expect(
      service.handleOAuthCallback({ provider: 'vk', providerId: 'vk-1' }),
    ).resolves.toEqual(tokens);

    expect(authService.generateTokens).toHaveBeenCalledWith(existing);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(randomBytesMock).not.toHaveBeenCalled();
    expect(hashMock).not.toHaveBeenCalled();
  });

  it.each([
    ['email', { email: 'linked@example.test' }],
    ['phone', { phone: '+79990000000' }],
  ] as const)('links by %s without replacing the password hash', async (_, identity) => {
    const existing = { id: 'linked', passwordHash: 'existing-password-hash', ...identity };
    const linked = { ...existing, yandexId: 'ya-1' };
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(linked);

    await expect(
      service.handleOAuthCallback({
        provider: 'yandex',
        providerId: 'ya-1',
        ...identity,
      }),
    ).resolves.toEqual(tokens);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { yandexId: 'ya-1' },
    });
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty(
      'passwordHash',
    );
    expect(linked.passwordHash).toBe(existing.passwordHash);
    expect(randomBytesMock).not.toHaveBeenCalled();
    expect(hashMock).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('keeps the calm 400 boundary when the provider supplies no identity', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.handleOAuthCallback({ provider: 'mailru', providerId: 'mail-1' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.handleOAuthCallback({ provider: 'mailru', providerId: 'mail-1' }),
    ).rejects.toThrow('OAuth провайдер не предоставил email или телефон');

    expect(randomBytesMock).not.toHaveBeenCalled();
    expect(hashMock).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('creates no user and issues no token when secure randomness fails', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    randomBytesMock.mockImplementation(() => {
      throw new Error('CSPRNG unavailable');
    });

    await expect(
      service.handleOAuthCallback({
        provider: 'yandex',
        providerId: 'ya-fail',
        email: 'fail@example.test',
      }),
    ).rejects.toThrow('CSPRNG unavailable');

    expect(hashMock).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('creates no user and issues no token when hashing fails', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    hashMock.mockRejectedValue(new Error('bcrypt unavailable') as never);

    await expect(
      service.handleOAuthCallback({
        provider: 'vk',
        providerId: 'vk-fail',
        phone: '+79991111111',
      }),
    ).rejects.toThrow('bcrypt unavailable');

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });
});
