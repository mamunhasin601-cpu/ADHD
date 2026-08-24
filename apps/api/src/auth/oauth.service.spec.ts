import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { BCRYPT_ROUNDS, OAUTH_BOOTSTRAP_SECRET_BYTES } from './auth.constants';
import { OAuthProfile, OAuthService } from './oauth.service';
import {
  OAuthAccountLinkingRequiredError,
  OAUTH_ACCOUNT_LINKING_REQUIRED_MESSAGE,
} from './oauth-account-linking.error';

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

  it.each([
    ['yandex', undefined],
    ['yandex', null],
    ['yandex', ''],
    ['yandex', '   '],
    ['yandex', { id: 'not-a-string' }],
    ['vk', undefined],
    ['vk', null],
    ['vk', ''],
    ['vk', '\t\r\n'],
    ['vk', 42],
    ['mailru', undefined],
    ['mailru', null],
    ['mailru', ''],
    ['mailru', '  '],
    ['mailru', ['not-a-string']],
  ] as const)(
    'rejects an unusable %s provider ID before any persistence or issuance (%p)',
    async (provider, providerId) => {
      await expect(
        service.handleOAuthCallback({
          provider,
          providerId,
          email: 'must-not-be-looked-up@example.test',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user).not.toHaveProperty('update');
      expect(randomBytesMock).not.toHaveBeenCalled();
      expect(hashMock).not.toHaveBeenCalled();
      expect(authService.generateTokens).not.toHaveBeenCalled();
      logSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    },
  );

  it.each([
    ['yandex', 'yandexId'],
    ['vk', 'vkId'],
    ['mailru', 'mailruId'],
  ] as const)(
    'returns tokens for an existing %s provider identity without mutation',
    async (provider, providerIdField) => {
      const existing = { id: 'existing', passwordHash: 'preserved' };
      prisma.user.findFirst.mockResolvedValueOnce(existing);

      await expect(
        service.handleOAuthCallback({
          provider,
          providerId: `${provider}-1`,
          email: 'belongs-to-someone-else@example.test',
          phone: '+79999999999',
        }),
      ).resolves.toEqual(tokens);

      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { [providerIdField]: `${provider}-1` },
      });
      expect(authService.generateTokens).toHaveBeenCalledWith(existing);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(randomBytesMock).not.toHaveBeenCalled();
      expect(hashMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['email only', { email: 'existing@example.test' }],
    ['phone only', { phone: '+79990000000' }],
    [
      'email and phone matching the same user',
      { email: 'same@example.test', phone: '+79990000001' },
    ],
    [
      'email and phone matching different users',
      { email: 'first@example.test', phone: '+79990000002' },
    ],
  ] as const)('fails closed for an unlinked %s match', async (_, identity) => {
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'identity-match' });

    const error = await service
      .handleOAuthCallback({
        provider: 'yandex',
        providerId: 'unlinked-provider-id',
        ...identity,
      })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(OAuthAccountLinkingRequiredError);
    expect(error.message).toBe(OAUTH_ACCOUNT_LINKING_REQUIRED_MESSAGE);

    expect(prisma.user).not.toHaveProperty('update');
    expect(randomBytesMock).not.toHaveBeenCalled();
    expect(hashMock).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(authService.generateTokens).not.toHaveBeenCalled();
    logSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('keeps repeated denied callbacks free of mutations and token issuance', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' });
    const profile: OAuthProfile = {
      provider: 'vk',
      providerId: 'unlinked-vk',
      email: 'existing@example.test',
    };

    await expect(service.handleOAuthCallback(profile)).rejects.toBeInstanceOf(
      OAuthAccountLinkingRequiredError,
    );
    await expect(service.handleOAuthCallback(profile)).rejects.toBeInstanceOf(
      OAuthAccountLinkingRequiredError,
    );

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(authService.generateTokens).not.toHaveBeenCalled();
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
    expect(authService.generateTokens).not.toHaveBeenCalled();
  });

  it('recovers a same-provider P2002 replay only by exact provider ID', async () => {
    const concurrentUser = { id: 'concurrent-provider-user' };
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentUser);
    prisma.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });

    await expect(
      service.handleOAuthCallback({
        provider: 'mailru',
        providerId: 'mail-concurrent',
        email: 'new@example.test',
      }),
    ).resolves.toEqual(tokens);

    expect(prisma.user.findFirst).toHaveBeenLastCalledWith({
      where: { mailruId: 'mail-concurrent' },
    });
    expect(authService.generateTokens).toHaveBeenCalledTimes(1);
    expect(authService.generateTokens).toHaveBeenCalledWith(concurrentUser);
  });

  it('fails closed after P2002 when the exact provider ID is absent', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['phone'], sensitive: 'must-not-escape' },
    });

    await expect(
      service.handleOAuthCallback({
        provider: 'vk',
        providerId: 'vk-conflict',
        phone: '+79992222222',
      }),
    ).rejects.toEqual(new OAuthAccountLinkingRequiredError());

    expect(prisma.user.findFirst).toHaveBeenLastCalledWith({
      where: { vkId: 'vk-conflict' },
    });
    expect(authService.generateTokens).not.toHaveBeenCalled();
    logSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('issues no token for an unexpected persistence failure', async () => {
    const persistenceError = new Error('database unavailable');
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(persistenceError);

    await expect(
      service.handleOAuthCallback({
        provider: 'yandex',
        providerId: 'ya-persistence-failure',
        email: 'new@example.test',
      }),
    ).rejects.toBe(persistenceError);

    expect(authService.generateTokens).not.toHaveBeenCalled();
  });
});
