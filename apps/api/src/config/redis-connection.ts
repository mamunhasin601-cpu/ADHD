/** Converts the already-validated REDIS_URL into BullMQ connection options. */
export function redisConnectionFromUrl(value: string) {
  const url = new URL(value);
  const username = decodeRedisCredential(url.username);
  const password = decodeRedisCredential(url.password);
  const databasePath = url.pathname.slice(1);
  const database = databasePath === '' ? undefined : Number(databasePath);
  if (database !== undefined && (!Number.isSafeInteger(database) || database < 0)) {
    throw new Error('Invalid core configuration: REDIS_URL database path must be a non-negative integer');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(database !== undefined ? { db: database } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export function decodeRedisCredential(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('Invalid core configuration: REDIS_URL contains malformed credential encoding');
  }
}
