/** Converts the already-validated REDIS_URL into BullMQ connection options. */
export function redisConnectionFromUrl(value: string) {
  const url = new URL(value);
  const databasePath = url.pathname.slice(1);
  const database = databasePath === '' ? undefined : Number(databasePath);
  if (database !== undefined && (!Number.isSafeInteger(database) || database < 0)) {
    throw new Error('Invalid core configuration: REDIS_URL database path must be a non-negative integer');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database !== undefined ? { db: database } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
