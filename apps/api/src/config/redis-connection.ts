/** Converts the already-validated REDIS_URL into BullMQ connection options. */
export function redisConnectionFromUrl(value: string) {
  const url = new URL(value);
  const database = url.pathname.slice(1);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
