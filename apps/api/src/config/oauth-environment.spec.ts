import { validateOAuthEnvironment } from './oauth-environment';

const enabledYandex = (overrides: Record<string, unknown> = {}) => ({
  YANDEX_OAUTH_ENABLED: 'true',
  YANDEX_CLIENT_ID: 'yandex-client',
  YANDEX_CLIENT_SECRET: 'yandex-secret',
  YANDEX_REDIRECT_URI: 'https://oauth.focus.ru/auth/yandex/callback',
  ...overrides,
});

describe('validateOAuthEnvironment', () => {
  it('returns typed false flags when all providers are absent', () => {
    expect(validateOAuthEnvironment({}, 'production')).toMatchObject({
      YANDEX_OAUTH_ENABLED: false,
      VK_OAUTH_ENABLED: false,
      MAILRU_OAUTH_ENABLED: false,
    });
  });

  it('enables providers independently and returns booleans', () => {
    const result = validateOAuthEnvironment({
      ...enabledYandex(),
      VK_OAUTH_ENABLED: 'false',
    }, 'production');
    expect(result.YANDEX_OAUTH_ENABLED).toBe(true);
    expect(result.VK_OAUTH_ENABLED).toBe(false);
    expect(typeof result.YANDEX_OAUTH_ENABLED).toBe('boolean');
  });

  it.each(['TRUE', 'False', '', ' true ', 1, true, null, {}, []])('rejects invalid flag %p', (value) => {
    expect(() => validateOAuthEnvironment({ VK_OAUTH_ENABLED: value }, 'test')).toThrow('VK_OAUTH_ENABLED');
  });

  it.each([
    ['YANDEX_OAUTH_ENABLED', 'YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET', 'YANDEX_REDIRECT_URI', '/auth/yandex/callback'],
    ['YANDEX_OAUTH_ENABLED', 'YANDEX_CLIENT_SECRET', 'YANDEX_CLIENT_ID', 'YANDEX_REDIRECT_URI', '/auth/yandex/callback'],
    ['YANDEX_OAUTH_ENABLED', 'YANDEX_REDIRECT_URI', 'YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET', '/auth/yandex/callback'],
    ['VK_OAUTH_ENABLED', 'VK_CLIENT_ID', 'VK_CLIENT_SECRET', 'VK_REDIRECT_URI', '/auth/vk/callback'],
    ['VK_OAUTH_ENABLED', 'VK_CLIENT_SECRET', 'VK_CLIENT_ID', 'VK_REDIRECT_URI', '/auth/vk/callback'],
    ['VK_OAUTH_ENABLED', 'VK_REDIRECT_URI', 'VK_CLIENT_ID', 'VK_CLIENT_SECRET', '/auth/vk/callback'],
    ['MAILRU_OAUTH_ENABLED', 'MAILRU_CLIENT_ID', 'MAILRU_CLIENT_SECRET', 'MAILRU_REDIRECT_URI', '/auth/mailru/callback'],
    ['MAILRU_OAUTH_ENABLED', 'MAILRU_CLIENT_SECRET', 'MAILRU_CLIENT_ID', 'MAILRU_REDIRECT_URI', '/auth/mailru/callback'],
    ['MAILRU_OAUTH_ENABLED', 'MAILRU_REDIRECT_URI', 'MAILRU_CLIENT_ID', 'MAILRU_CLIENT_SECRET', '/auth/mailru/callback'],
  ])('rejects missing %s variable %s independently', (flag, key, firstOtherKey, secondOtherKey, path) => {
    const environment: Record<string, unknown> = {
      [flag]: 'true',
      [firstOtherKey]: 'configured-value',
      [secondOtherKey]: secondOtherKey.endsWith('REDIRECT_URI') ? `https://oauth.focus.ru${path}` : 'configured-value',
    };
    delete environment[key];
    expect(() => validateOAuthEnvironment(environment, 'production')).toThrow(key);
  });

  it.each(['', ' ', 'padded ', ' dev-client-id', 'dev-client-id', 'dev-secret', 'change-me', 'replace-me', 'your-client-id', 'your-client-secret', 'your-secret-here'])('rejects unsafe credentials without disclosure: %p', (value) => {
    let message = '';
    try {
      validateOAuthEnvironment(enabledYandex({ YANDEX_CLIENT_SECRET: value }), 'production');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('YANDEX_CLIENT_SECRET');
    if (value.trim().length > 1) expect(message).not.toContain(value.trim());
  });

  it('does not require or use credentials for a disabled provider', () => {
    const result = validateOAuthEnvironment({
      MAILRU_OAUTH_ENABLED: 'false',
      MAILRU_CLIENT_SECRET: { unsafe: true },
    }, 'production');
    expect(result.MAILRU_OAUTH_ENABLED).toBe(false);
    expect(result).not.toHaveProperty('MAILRU_CLIENT_SECRET');
  });

  it.each([
    ['yandex', 'YANDEX_OAUTH_ENABLED', 'YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET', 'YANDEX_REDIRECT_URI', '/auth/yandex/callback'],
    ['vk', 'VK_OAUTH_ENABLED', 'VK_CLIENT_ID', 'VK_CLIENT_SECRET', 'VK_REDIRECT_URI', '/auth/vk/callback'],
    ['mailru', 'MAILRU_OAUTH_ENABLED', 'MAILRU_CLIENT_ID', 'MAILRU_CLIENT_SECRET', 'MAILRU_REDIRECT_URI', '/auth/mailru/callback'],
  ])('accepts complete %s configuration', (_provider, flag, clientId, secret, redirect, path) => {
    expect(validateOAuthEnvironment({
      [flag]: 'true', [clientId]: 'client-id', [secret]: 'provider-secret', [redirect]: `https://oauth.focus.ru${path}`,
    }, 'production')[flag]).toBe(true);
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts development/test HTTP loopback host %s', (host) => {
    expect(validateOAuthEnvironment(enabledYandex({ YANDEX_REDIRECT_URI: `http://${host}:3000/auth/yandex/callback` }), 'test').YANDEX_OAUTH_ENABLED).toBe(true);
  });

  it.each([
    'http://oauth.focus.ru/auth/yandex/callback',
    'https://localhost/auth/yandex/callback',
    'https://127.0.0.1/auth/yandex/callback',
    'https://oauth.focus.test/auth/yandex/callback',
    'https://oauth.focus.example/auth/yandex/callback',
    'https://oauth.focus.invalid/auth/yandex/callback',
    'https://user:password@oauth.focus.ru/auth/yandex/callback',
    'https://oauth.focus.ru/wrong/callback',
    'https://oauth.focus.ru/auth/yandex/callback?code=sensitive-query',
    'https://oauth.focus.ru/auth/yandex/callback#sensitive-fragment',
    'not-a-url-sensitive',
  ])('rejects unsafe production redirect without disclosure: %s', (value) => {
    let message = '';
    try {
      validateOAuthEnvironment(enabledYandex({ YANDEX_REDIRECT_URI: value }), 'production');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('YANDEX_REDIRECT_URI');
    expect(message).not.toContain(value);
    expect(message).not.toMatch(/sensitive-query|sensitive-fragment|password/);
  });

  it('accepts remote HTTPS but rejects remote HTTP in development', () => {
    expect(validateOAuthEnvironment(enabledYandex(), 'development').YANDEX_OAUTH_ENABLED).toBe(true);
    expect(() => validateOAuthEnvironment(enabledYandex({ YANDEX_REDIRECT_URI: 'http://oauth.focus.ru/auth/yandex/callback' }), 'development')).toThrow('YANDEX_REDIRECT_URI');
  });
});
