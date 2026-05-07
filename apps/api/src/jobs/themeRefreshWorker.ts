/**
 * BullMQ worker for `theme-refresh-app` jobs.
 *
 * At M6.5 launch, all apps use manual review paste (no automatic source).
 * This worker no-ops with status "no_source_configured" until M9 wires
 * automatic review fetching from store URLs.
 */
import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from './redis.js';
import { QUEUE_NAME } from './scheduler.js';

export interface ThemeRefreshJobData {
  appId: string;
}

export interface ThemeRefreshJobResult {
  status: 'no_source_configured' | 'refreshed' | 'skipped';
  appId: string;
}

export function startThemeRefreshWorker(): Worker<ThemeRefreshJobData, ThemeRefreshJobResult> {
  const connection = getRedisConnection();

  const worker = new Worker<ThemeRefreshJobData, ThemeRefreshJobResult>(
    QUEUE_NAME,
    async (job: Job<ThemeRefreshJobData>): Promise<ThemeRefreshJobResult> => {
      const { appId } = job.data;

      // M9 will check appStoreUrl / playStoreUrl and fetch reviews automatically.
      // For now, all apps are manual-paste only.
      return { status: 'no_source_configured', appId };
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[themeRefreshWorker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
