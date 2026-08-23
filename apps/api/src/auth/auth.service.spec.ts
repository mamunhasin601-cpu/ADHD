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

jest.mock('./jwt-secrets', () => ({
  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
}));

describe('AuthService password compatibility', () => {
  it('registers at the shared cost and accepts the same password on login', async () => {
    let storedUser: any;
    const prisma: any = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockImplementation(() => Promise.resolve(storedUser)),
        create: jest.fn().mockImplementation(({ data }) => {
          storedUser = { id: 'password-user', ...data };
          return Promise.resolve(storedUser);
        }),
      },
    };
    const jwtService: any = {
      sign: jest.fn((payload, options) => `${payload.sub}:${options.secret}`),
    };
    const service = new AuthService(prisma, jwtService);
    const registration = await service.register({
      email: 'password@example.test',
      password: 'correct horse battery staple',
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
});
