import { REQUIRED_CORE_ENVIRONMENT_KEYS, validateCoreEnvironment } from './core-environment';

const validEnvironment = () => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://database-user:database-password@db.example.test:5432/focus',
  REDIS_URL: 'rediss://redis-user:redis-password@redis.example.test:6380/2',
  JWT_SECRET: 'access-secret-abcdefghijklmnopqrstuvwxyz-0123456789',
  JWT_REFRESH_SECRET: 'refresh-secret-abcdefghijklmnopqrstuvwxyz-9876543210',
  PORT: '3000',
});

const oauthEnvironment = (overrides: Record<string, unknown> = {}) => ({
  ...validEnvironment(),
  ...overrides,
});

describe('validateCoreEnvironment', () => {
  const verificationEnvironment = {
    CONTACT_VERIFICATION_ENABLED: 'true',
    CONTACT_VERIFICATION_SECRET: 'verification-secret-abcdefghijklmnopqrstuvwxyz-0123456789',
    SMSAERO_EMAIL: 'api@example.ru',
    SMSAERO_API_KEY: 'smsaero-secret',
    SMSAERO_SIGN: 'Focus',
    TIMEWEB_SMTP_USER: 'smtp-user',
    TIMEWEB_SMTP_PASSWORD: 'smtp-password',
    TIMEWEB_SMTP_FROM_EMAIL: 'no-reply@example.ru',
    TIMEWEB_SMTP_FROM_NAME: 'Focus',
  };
  it.each(['development', 'test', 'production'])('accepts a complete %s configuration', (NODE_ENV) => {
    expect(validateCoreEnvironment({ ...validEnvironment(), NODE_ENV })).toMatchObject({
      NODE_ENV,
      PORT: 3000,
    });
  });

  it.each(REQUIRED_CORE_ENVIRONMENT_KEYS)('rejects missing %s independently', (key) => {
    const environment: Record<string, unknown> = validEnvironment();
    delete environment[key];
    expect(() => validateCoreEnvironment(environment)).toThrow(key);
  });

  it('defaults an absent PORT to numeric 3000', () => {
    const environment: Record<string, unknown> = validEnvironment();
    delete environment.PORT;
    expect(validateCoreEnvironment(environment).PORT).toBe(3000);
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
    'redis://localhost/not-a-db',
    'redis://localhost/-1',
    'redis://localhost/1.5',
    'redis://localhost/1/2',
    `redis://user:redis-password@localhost/${'9'.repeat(400)}`,
  ])('rejects invalid Redis database path without disclosing the URL: %p', (REDIS_URL) => {
    let message = '';
    try {
      validateCoreEnvironment({ ...validEnvironment(), REDIS_URL });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('REDIS_URL');
    expect(message).not.toContain(REDIS_URL);
    expect(message).not.toContain('redis-password');
  });

  it.each(['redis://localhost', 'redis://localhost/', 'redis://localhost/0', 'redis://localhost/12'])(
    'accepts valid Redis database path %p',
    (REDIS_URL) => expect(validateCoreEnvironment({ ...validEnvironment(), REDIS_URL }).REDIS_URL).toBe(REDIS_URL),
  );

  it.each([
    'redis://%E0%A4%A:password@localhost/0',
    'redis://user:%E0%A4%A@localhost/0',
  ])('rejects malformed Redis credential encoding with a safe error for %p', (REDIS_URL) => {
    let message = '';
    try {
      validateCoreEnvironment({ ...validEnvironment(), REDIS_URL });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('REDIS_URL');
    expect(message).not.toContain(REDIS_URL);
    expect(message).not.toContain('user');
    expect(message).not.toContain('password');
    expect(message).not.toContain('%E0%A4%A');
  });

  it.each([
    ['JWT_SECRET', 'short'],
    ['JWT_REFRESH_SECRET', ' short-secret-that-is-long-enough-123456789 '],
    ['JWT_SECRET', 'замените-на-длинную-случайную-строку-минимум-64-символа'],
    ['JWT_REFRESH_SECRET', 'другая-длинная-случайная-строка-для-refresh-токенов'],
    ['JWT_SECRET', 'change-me-change-me-change-me-change-me'],
    ['JWT_REFRESH_SECRET', 'replace-me-replace-me-replace-me-replace-me'],
    ['JWT_SECRET', 'your-secret-here-your-secret-here-your-secret-here'],
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

  it('disables all OAuth providers when flags are absent', () => {
    expect(validateCoreEnvironment(oauthEnvironment())).toMatchObject({
      YANDEX_OAUTH_ENABLED: false,
      VK_OAUTH_ENABLED: false,
      MAILRU_OAUTH_ENABLED: false,
    });
  });

  it('accepts exact false and independently enables configured providers', () => {
    const result = validateCoreEnvironment(oauthEnvironment({
      YANDEX_OAUTH_ENABLED: 'false',
      VK_OAUTH_ENABLED: 'true',
      VK_CLIENT_ID: 'vk-client', VK_CLIENT_SECRET: 'vk-secret', VK_REDIRECT_URI: 'https://oauth.example.ru/auth/vk/callback',
    }));
    expect(result.YANDEX_OAUTH_ENABLED).toBe(false);
    expect(result.VK_OAUTH_ENABLED).toBe(true);
    expect(result.MAILRU_OAUTH_ENABLED).toBe(false);
    expect(result.VK_CLIENT_ID).toBe('vk-client');
  });

  it.each(['TRUE', 'False', '1', ' true ', 1, true, {}, []])('rejects invalid OAuth flag %p', (value) => {
    expect(() => validateCoreEnvironment(oauthEnvironment({ YANDEX_OAUTH_ENABLED: value }))).toThrow('YANDEX_OAUTH_ENABLED');
  });

  it.each(['YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET', 'YANDEX_REDIRECT_URI'])('requires enabled Yandex variable %s', (key) => {
    expect(() => validateCoreEnvironment(oauthEnvironment({ YANDEX_OAUTH_ENABLED: 'true', YANDEX_CLIENT_ID: 'id', YANDEX_CLIENT_SECRET: 'secret', YANDEX_REDIRECT_URI: 'https://oauth.example.ru/auth/yandex/callback', [key]: undefined }))).toThrow(key);
  });

  it.each(['', ' ', ' dev-secret', 'change-me', 'replace-me', 'your-client-id', 'your-client-secret', 'your-secret-here'])('rejects unsafe OAuth credential %p without disclosure', (value) => {
    const environment = oauthEnvironment({ YANDEX_OAUTH_ENABLED: 'true', YANDEX_CLIENT_ID: value, YANDEX_CLIENT_SECRET: 'secret', YANDEX_REDIRECT_URI: 'https://oauth.example.ru/auth/yandex/callback' });
    let message = '';
    try { validateCoreEnvironment(environment); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('YANDEX_CLIENT_ID');
    if (value.trim().length > 1) expect(message).not.toContain(value.trim());
  });

  it('accepts production HTTPS and development localhost HTTP redirects', () => {
    expect(validateCoreEnvironment(oauthEnvironment({ YANDEX_OAUTH_ENABLED: 'true', YANDEX_CLIENT_ID: 'id', YANDEX_CLIENT_SECRET: 'secret', YANDEX_REDIRECT_URI: 'https://oauth.focus.ru/auth/yandex/callback' })).YANDEX_OAUTH_ENABLED).toBe(true);
    expect(validateCoreEnvironment(oauthEnvironment({ NODE_ENV: 'development', YANDEX_OAUTH_ENABLED: 'true', YANDEX_CLIENT_ID: 'id', YANDEX_CLIENT_SECRET: 'secret', YANDEX_REDIRECT_URI: 'http://localhost:3000/auth/yandex/callback' })).YANDEX_REDIRECT_URI).toBe('http://localhost:3000/auth/yandex/callback');
  });

  it.each(['http://oauth.focus.ru/auth/yandex/callback', 'https://localhost/auth/yandex/callback', 'https://oauth.focus.test/auth/yandex/callback', 'https://oauth.focus.ru/auth/yandex/callback?x=secret', 'https://oauth.focus.ru/auth/yandex/callback#secret'])('rejects invalid production redirect %s without disclosure', (redirect) => {
    expect(() => validateCoreEnvironment(oauthEnvironment({ YANDEX_OAUTH_ENABLED: 'true', YANDEX_CLIENT_ID: 'id', YANDEX_CLIENT_SECRET: 'secret', YANDEX_REDIRECT_URI: redirect }))).toThrow('YANDEX_REDIRECT_URI');
  });

  it('rejects arbitrary remote HTTP redirects outside production', () => {
    expect(() => validateCoreEnvironment(oauthEnvironment({ NODE_ENV: 'test', YANDEX_OAUTH_ENABLED: 'true', YANDEX_CLIENT_ID: 'id', YANDEX_CLIENT_SECRET: 'secret', YANDEX_REDIRECT_URI: 'http://oauth.focus.ru/auth/yandex/callback' }))).toThrow('YANDEX_REDIRECT_URI');
  });

  it.each(['', ' ', '0', '65536', '3.5', '3000 ', 'abc', '-1'])(
    'rejects invalid PORT %p',
    (PORT) => expect(() => validateCoreEnvironment({ ...validEnvironment(), PORT })).toThrow('PORT'),
  );

  it('does not disclose URL credentials in validation errors', () => {
    const password = 'highly-sensitive-database-password';
    expect(() => validateCoreEnvironment({
      ...validEnvironment(), DATABASE_URL: `mysql://user:${password}@db.example.test/focus`,
    })).toThrow(expect.not.stringContaining(password));
  });

  it.each([undefined, 'false', 'TRUE', '1', ' true '])(
    'keeps contact verification disabled unless the value is exact lowercase true (%p)',
    (CONTACT_VERIFICATION_ENABLED) => {
      const result = validateCoreEnvironment({ ...validEnvironment(), CONTACT_VERIFICATION_ENABLED });
      expect(result.CONTACT_VERIFICATION_ENABLED).toBe(false);
    },
  );

  it('accepts a complete enabled contact verification configuration', () => {
    expect(validateCoreEnvironment({ ...validEnvironment(), ...verificationEnvironment }).CONTACT_VERIFICATION_ENABLED).toBe(true);
  });

  it.each([
    'CONTACT_VERIFICATION_SECRET', 'SMSAERO_EMAIL', 'SMSAERO_API_KEY', 'SMSAERO_SIGN',
    'TIMEWEB_SMTP_USER', 'TIMEWEB_SMTP_PASSWORD', 'TIMEWEB_SMTP_FROM_EMAIL', 'TIMEWEB_SMTP_FROM_NAME',
  ])('fails startup when enabled %s is missing without disclosing values', (key) => {
    const environment: Record<string, unknown> = { ...validEnvironment(), ...verificationEnvironment };
    delete environment[key];
    expect(() => validateCoreEnvironment(environment)).toThrow(key);
  });

  it.each(['short', 'change-me', ' verification-secret-abcdefghijklmnopqrstuvwxyz-0123456789 '])(
    'rejects weak, placeholder, or padded verification secret %p',
    (CONTACT_VERIFICATION_SECRET) => expect(() => validateCoreEnvironment({
      ...validEnvironment(), ...verificationEnvironment, CONTACT_VERIFICATION_SECRET,
    })).toThrow('CONTACT_VERIFICATION_SECRET'),
  );

  it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET'])('rejects verification secret reuse with %s', (key) => {
    const environment: Record<string, string> = { ...validEnvironment(), ...verificationEnvironment };
    environment.CONTACT_VERIFICATION_SECRET = environment[key];
    expect(() => validateCoreEnvironment(environment)).toThrow('dedicated');
  });
});
