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
});

