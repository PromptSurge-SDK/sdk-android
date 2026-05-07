/**
 * BullMQ scheduler — enqueues one `theme-refresh-app` job per app per week.
 *
 * Called once on API startup. Uses a repeatable job keyed by appId so
 * re-running on deploy doesn't duplicate schedules.
 */
import { Queue } from 'bullmq';
import { getRedisConnection } from './redis.js';
import { prisma } from '../db.js';

export const QUEUE_NAME = 'theme-refresh-app';

export async function startScheduler(): Promise<void> {
  const connection = getRedisConnection();
  const queue = new Queue<{ appId: string }>(QUEUE_NAME, { connection });

  // Load all app IDs
  const apps = await prisma.app.findMany({ select: { id: true } });

  for (const app of apps) {
    // One repeatable job per app — keyed by appId so re-deploys are idempotent
    await queue.add(
      'refresh',
      { appId: app.id },
      {
        repeat: { every: 7 * 24 * 60 * 60 * 1000 }, // 7 days in ms
        jobId: `theme-refresh-${app.id}`,
      },
    );
  }

  console.log(`[scheduler] Scheduled theme-refresh for ${apps.length} app(s).`);
}
