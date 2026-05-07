import { Redis } from 'ioredis';

let _connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!_connection) {
    _connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // Required by BullMQ
      lazyConnect: true,
      // Stop retrying after a few attempts so the process doesn't hang
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    // Prevent unhandled-error crashes — startup code logs and ignores
    _connection.on('error', () => {});
  }
  return _connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
}
