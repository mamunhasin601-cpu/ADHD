export interface OAuthEnvironment {
  YANDEX_OAUTH_ENABLED: boolean;
  VK_OAUTH_ENABLED: boolean;
  MAILRU_OAUTH_ENABLED: boolean;
  YANDEX_CLIENT_ID?: string;
  YANDEX_CLIENT_SECRET?: string;
  YANDEX_REDIRECT_URI?: string;
  VK_CLIENT_ID?: string;
  VK_CLIENT_SECRET?: string;
  VK_REDIRECT_URI?: string;
  MAILRU_CLIENT_ID?: string;
  MAILRU_CLIENT_SECRET?: string;
  MAILRU_REDIRECT_URI?: string;
}

const PROVIDERS = [
  {
    flag: 'YANDEX_OAUTH_ENABLED',
    clientId: 'YANDEX_CLIENT_ID',
    clientSecret: 'YANDEX_CLIENT_SECRET',
    redirectUri: 'YANDEX_REDIRECT_URI',
    pathname: '/auth/yandex/callback',
  },
  {
    flag: 'VK_OAUTH_ENABLED',
    clientId: 'VK_CLIENT_ID',
    clientSecret: 'VK_CLIENT_SECRET',
    redirectUri: 'VK_REDIRECT_URI',
    pathname: '/auth/vk/callback',
  },
  {
    flag: 'MAILRU_OAUTH_ENABLED',
    clientId: 'MAILRU_CLIENT_ID',
    clientSecret: 'MAILRU_CLIENT_SECRET',
    redirectUri: 'MAILRU_REDIRECT_URI',
    pathname: '/auth/mailru/callback',
  },
] as const;

const PLACEHOLDER_VALUES = new Set([
  'dev-client-id',
  'dev-secret',
  'change-me',
  'replace-me',
  'your-client-id',
  'your-client-secret',
  'your-secret-here',
]);

function enabledFlag(environment: Record<string, unknown>, key: string): boolean {
  const value = environment[key];
  if (value === undefined) return false;
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid OAuth configuration: ${key} must be exactly true or false`);
  }
  return value === 'true';
}

function requiredValue(environment: Record<string, unknown>, key: string): string {
  const value = environment[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid OAuth configuration: ${key} is required`);
  }
  if (value !== value.trim()) {
    throw new Error(`Invalid OAuth configuration: ${key} must not contain surrounding whitespace`);
  }
  if (PLACEHOLDER_VALUES.has(value.toLowerCase())) {
    throw new Error(`Invalid OAuth configuration: ${key} must not use a placeholder value`);
  }
  return value;
}

function isAllowedDevelopmentLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function isProductionForbiddenHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.startsWith('127.') || hostname === '[::1]' || hostname === '::1' ||
    ['test', 'example', 'invalid'].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function validateRedirectUri(value: string, key: string, pathname: string, nodeEnv: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid OAuth configuration: ${key} must be an absolute URL`);
  }
  if (!url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== pathname) {
    throw new Error(`Invalid OAuth configuration: ${key} has invalid callback URL`);
  }
  const hostname = url.hostname.toLowerCase();
  if (nodeEnv === 'production') {
    if (url.protocol !== 'https:' || isProductionForbiddenHost(hostname)) {
      throw new Error(`Invalid OAuth configuration: ${key} has invalid production callback URL`);
    }
    return;
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isAllowedDevelopmentLoopback(hostname))) {
    throw new Error(`Invalid OAuth configuration: ${key} has invalid development callback URL`);
  }
}

export function validateOAuthEnvironment(
  environment: Record<string, unknown>,
  nodeEnv: 'development' | 'test' | 'production',
): OAuthEnvironment & Record<string, unknown> {
  const result: Record<string, unknown> = { ...environment };
  for (const provider of PROVIDERS) {
    const enabled = enabledFlag(environment, provider.flag);
    result[provider.flag] = enabled;
    if (!enabled) {
      delete result[provider.clientId];
      delete result[provider.clientSecret];
      delete result[provider.redirectUri];
      continue;
    }
    const clientId = requiredValue(environment, provider.clientId);
    const clientSecret = requiredValue(environment, provider.clientSecret);
    const redirectUri = requiredValue(environment, provider.redirectUri);
    validateRedirectUri(redirectUri, provider.redirectUri, provider.pathname, nodeEnv);
    result[provider.clientId] = clientId;
    result[provider.clientSecret] = clientSecret;
    result[provider.redirectUri] = redirectUri;
  }
  return result as OAuthEnvironment & Record<string, unknown>;
}
