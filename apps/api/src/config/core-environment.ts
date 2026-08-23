export const CORE_ENVIRONMENT_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PORT',
] as const;

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface CoreEnvironment extends Record<string, unknown> {
  NODE_ENV: NodeEnvironment;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  PORT: number;
}

const EXAMPLE_JWT_SECRETS = new Set([
  'замените-на-длинную-случайную-строку-минимум-64-символа',
  'другая-длинная-случайная-строка-для-refresh-токенов',
]);

function requiredExactString(
  environment: Record<string, unknown>,
  key: (typeof CORE_ENVIRONMENT_KEYS)[number],
): string {
  const value = environment[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid core configuration: ${key} is required`);
  }
  if (value !== value.trim()) {
    throw new Error(`Invalid core configuration: ${key} must not contain surrounding whitespace`);
  }
  return value;
}

function requireUrl(value: string, key: 'DATABASE_URL' | 'REDIS_URL', protocols: string[]): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid core configuration: ${key} must be a valid URL`);
  }

  if (!protocols.includes(url.protocol) || !url.hostname) {
    throw new Error(`Invalid core configuration: ${key} must use an allowed protocol and host`);
  }
}

/** Pure validation only: this function never opens a database or network connection. */
export function validateCoreEnvironment(
  environment: Record<string, unknown>,
): CoreEnvironment {
  const nodeEnv = requiredExactString(environment, 'NODE_ENV');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('Invalid core configuration: NODE_ENV must be development, test, or production');
  }

  const databaseUrl = requiredExactString(environment, 'DATABASE_URL');
  requireUrl(databaseUrl, 'DATABASE_URL', ['postgresql:', 'postgres:']);

  const redisUrl = requiredExactString(environment, 'REDIS_URL');
  requireUrl(redisUrl, 'REDIS_URL', ['redis:', 'rediss:']);

  const jwtSecret = requiredExactString(environment, 'JWT_SECRET');
  const jwtRefreshSecret = requiredExactString(environment, 'JWT_REFRESH_SECRET');
  for (const [key, value] of [
    ['JWT_SECRET', jwtSecret],
    ['JWT_REFRESH_SECRET', jwtRefreshSecret],
  ] as const) {
    if (value.length < 32 || EXAMPLE_JWT_SECRETS.has(value)) {
      throw new Error(`Invalid core configuration: ${key} must be a non-example secret of at least 32 characters`);
    }
  }
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('Invalid core configuration: JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const portValue = requiredExactString(environment, 'PORT');
  if (!/^\d+$/.test(portValue)) {
    throw new Error('Invalid core configuration: PORT must be an integer from 1 through 65535');
  }
  const port = Number(portValue);
  if (port < 1 || port > 65535) {
    throw new Error('Invalid core configuration: PORT must be an integer from 1 through 65535');
  }

  return {
    ...environment,
    NODE_ENV: nodeEnv as NodeEnvironment,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    PORT: port,
  };
}

