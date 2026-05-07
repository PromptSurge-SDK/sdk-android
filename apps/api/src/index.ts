import 'dotenv/config';
import { buildApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';
import { startThemeRefreshWorker } from './jobs/themeRefreshWorker.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = await buildApp();

// Start background jobs only when Redis is explicitly configured
if (process.env.REDIS_URL) {
  try {
    startThemeRefreshWorker();
    await startScheduler();
  } catch (err) {
    app.log.warn({ err }, '[jobs] Failed to start scheduler/worker — Redis may be unavailable');
  }
} else {
  app.log.info('[jobs] REDIS_URL not set — skipping scheduler/worker startup');
}

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
