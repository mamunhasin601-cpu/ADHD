import { redisConnectionFromUrl } from './redis-connection';

describe('redisConnectionFromUrl', () => {
  it('derives BullMQ connection options from the validated REDIS_URL', () => {
    expect(redisConnectionFromUrl('rediss://worker:p%40ss@redis.example.test:6380/4')).toEqual({
      host: 'redis.example.test',
      port: 6380,
      username: 'worker',
      password: 'p@ss',
      db: 4,
      tls: {},
    });
  });

  it('preserves explicit local Docker compatibility', () => {
    expect(redisConnectionFromUrl('redis://localhost:6379')).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });

  it.each([
    ['redis://localhost', undefined],
    ['redis://localhost/', undefined],
    ['redis://localhost/0', 0],
    ['redis://localhost/12', 12],
  ] as const)('maps database path from %s', (url, db) => {
    const connection = redisConnectionFromUrl(url);
    if (db === undefined) expect(connection).not.toHaveProperty('db');
    else expect(connection).toHaveProperty('db', db);
  });

  it.each([
    'redis://localhost/not-a-db',
    'redis://localhost/-1',
    'redis://localhost/1.5',
    'redis://localhost/1/2',
    `redis://localhost/${'9'.repeat(400)}`,
  ])('never returns an invalid database option for %p', (url) => {
    expect(() => redisConnectionFromUrl(url)).toThrow('REDIS_URL');
  });
});
