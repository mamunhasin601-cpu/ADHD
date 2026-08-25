import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from './auth.constants';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn((password: string, rounds: number) =>
    Promise.resolve(`hash:${rounds}:${password}`),
  ),
  compare: jest.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hash:12:${password}`),
  ),
}));

describe('AuthService password compatibility', () => {
  it('registers at the shared cost and accepts the same password on login', async () => {
    let storedUser: any;
    const prisma: any = {
      user: {
        findFirst: jest
          .fn()
          .mockImplementation(() => Promise.resolve(storedUser)),
        create: jest.fn().mockImplementation(({ data }) => {
          storedUser = { id: 'password-user', ...data };
          return Promise.resolve(storedUser);
        }),
      },
    };
    prisma.$transaction = jest.fn(async (callback: (transaction: any) => Promise<any>) => callback({
      user: { create: prisma.user.create },
    }));
    const jwtService: any = {
      sign: jest.fn((payload, options) => `${payload.sub}:${options.secret}`),
    };
    const config: any = {
      getOrThrow: (key: string) => key === 'JWT_SECRET' ? 'test-access-secret' : 'test-refresh-secret',
      get: jest.fn(),
    };
    const verification: any = {
      canonicalize: (_channel: string, destination: string) => destination.toLowerCase(),
      isVerificationTicketUsable: jest.fn().mockResolvedValue(true),
      consumeVerificationTicket: jest.fn().mockResolvedValue(true),
    };
    const service = new AuthService(prisma, jwtService, config, verification);
    const registration = await service.register({
      email: 'password@example.test',
      password: 'correct horse battery staple',
      emailVerificationToken: 'A'.repeat(43),
    });
    const login = await service.login({
      email: 'password@example.test',
      password: 'correct horse battery staple',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith(
      'correct horse battery staple',
      BCRYPT_ROUNDS,
    );
    expect(BCRYPT_ROUNDS).toBe(12);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'correct horse battery staple',
      storedUser.passwordHash,
    );
    expect(login).toEqual(registration);
  });

  function loginHarness(user: any) {
    const prisma: any = { user: { findFirst: jest.fn().mockResolvedValue(user) } };
    const jwtService: any = { sign: jest.fn(() => 'jwt') };
    const config: any = { getOrThrow: jest.fn(() => 'secret'), get: jest.fn() };
    const verification: any = {};
    return { service: new AuthService(prisma, jwtService, config, verification), prisma };
  }

  it('logs into a canonical account with mixed-case email input', async () => {
    const user = { id: 'email-user', email: 'user@example.ru', phone: null, passwordHash: 'hash:12:password', timezone: 'Europe/Moscow' };
    const h = loginHarness(user);
    await expect(h.service.login({ email: 'UsEr@ExAmPlE.Ru', password: 'password' })).resolves.toEqual({ accessToken: 'jwt', refreshToken: 'jwt' });
    expect(h.prisma.user.findFirst).toHaveBeenCalledWith({ where: { email: { equals: 'UsEr@ExAmPlE.Ru', mode: 'insensitive' } } });
  });

  it('logs into a historical mixed-case email account case-insensitively', async () => {
    const user = { id: 'legacy-user', email: 'Legacy@Example.RU', phone: null, passwordHash: 'hash:12:password', timezone: 'Europe/Moscow' };
    const h = loginHarness(user);
    await expect(h.service.login({ email: 'LEGACY@example.ru', password: 'password' })).resolves.toBeTruthy();
    expect(h.prisma.user.findFirst).toHaveBeenCalledWith({ where: { email: { equals: 'LEGACY@example.ru', mode: 'insensitive' } } });
  });

  it('keeps phone lookup exact and builds only the requested branch', async () => {
    const user = { id: 'phone-user', email: null, phone: '+79991234567', passwordHash: 'hash:12:password', timezone: 'Europe/Moscow' };
    const h = loginHarness(user);
    await h.service.login({ phone: '+79991234567', password: 'password' });
    expect(h.prisma.user.findFirst).toHaveBeenCalledWith({ where: { phone: '+79991234567' } });
  });

  it('rejects missing identifiers and preserves the generic unauthorized outcome', async () => {
    const h = loginHarness(null);
    await expect(h.service.login({ password: 'password' })).rejects.toMatchObject({ status: 400, message: 'Нужен email или номер телефона' });
    await expect(h.service.login({ email: 'missing@example.ru', password: 'password' })).rejects.toMatchObject({ status: 401, message: 'Неверные учётные данные' });
    h.prisma.user.findFirst.mockResolvedValue({ id: 'u', email: 'user@example.ru', phone: null, passwordHash: 'other', timezone: 'Europe/Moscow' });
    await expect(h.service.login({ email: 'user@example.ru', password: 'password' })).rejects.toMatchObject({ status: 401, message: 'Неверные учётные данные' });
  });
});
