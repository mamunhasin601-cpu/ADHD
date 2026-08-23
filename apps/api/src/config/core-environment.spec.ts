import { CORE_ENVIRONMENT_KEYS, validateCoreEnvironment } from './core-environment';

const validEnvironment = () => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://database-user:database-password@db.example.test:5432/focus',
  REDIS_URL: 'rediss://redis-user:redis-password@redis.example.test:6380/2',
  JWT_SECRET: 'access-secret-abcdefghijklmnopqrstuvwxyz-0123456789',
  JWT_REFRESH_SECRET: 'refresh-secret-abcdefghijklmnopqrstuvwxyz-9876543210',
  PORT: '3000',
});

describe('validateCoreEnvironment', () => {
  it.each(['development', 'test', 'production'])('accepts a complete %s configuration', (NODE_ENV) => {
    expect(validateCoreEnvironment({ ...validEnvironment(), NODE_ENV })).toMatchObject({
      NODE_ENV,
      PORT: 3000,
    });
  });

  it.each(CORE_ENVIRONMENT_KEYS)('rejects missing %s independently', (key) => {
    const environment: Record<string, unknown> = validEnvironment();
    delete environment[key];
    expect(() => validateCoreEnvironment(environment)).toThrow(key);
  });

  it.each(['', 'Production', ' production', 'production ', 'staging'])(
    'rejects invalid NODE_ENV %p',
    (NODE_ENV) => expect(() => validateCoreEnvironment({ ...validEnvironment(), NODE_ENV })).toThrow('NODE_ENV'),
  );

  it.each([
    ['DATABASE_URL', 'mysql://db.example.test/focus'],
    ['DATABASE_URL', 'postgresql:not-a-host'],
    ['REDIS_URL', 'http://redis.example.test'],
    ['REDIS_URL', 'not a url'],
  ])('rejects malformed or unsupported %s', (key, value) => {
    expect(() => validateCoreEnvironment({ ...validEnvironment(), [key]: value })).toThrow(key);
  });

  it.each([
    ['JWT_SECRET', 'short'],
    ['JWT_REFRESH_SECRET', ' short-secret-that-is-long-enough-123456789 '],
    ['JWT_SECRET', 'замените-на-длинную-случайную-строку-минимум-64-символа'],
    ['JWT_REFRESH_SECRET', 'другая-длинная-случайная-строка-для-refresh-токенов'],
  ])('rejects weak, padded, or example %s values without disclosing them', (key, value) => {
    let message = '';
    try {
      validateCoreEnvironment({ ...validEnvironment(), [key]: value });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(key);
    expect(message).not.toContain(value);
  });

  it('requires separate access and refresh secrets without disclosing the secret', () => {
    const secret = 'same-secret-abcdefghijklmnopqrstuvwxyz-123456';
    expect(() => validateCoreEnvironment({
      ...validEnvironment(), JWT_SECRET: secret, JWT_REFRESH_SECRET: secret,
    })).toThrow('must be different');
    try {
      validateCoreEnvironment({ ...validEnvironment(), JWT_SECRET: secret, JWT_REFRESH_SECRET: secret });
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it.each(['0', '65536', '3.5', '3000 ', 'abc', '-1'])(
    'rejects invalid PORT %p',
    (PORT) => expect(() => validateCoreEnvironment({ ...validEnvironment(), PORT })).toThrow('PORT'),
  );

  it('does not disclose URL credentials in validation errors', () => {
    const password = 'highly-sensitive-database-password';
    expect(() => validateCoreEnvironment({
      ...validEnvironment(), DATABASE_URL: `mysql://user:${password}@db.example.test/focus`,
    })).toThrow(expect.not.stringContaining(password));
  });
});

