import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerEventsRoute } from './routes/events.js';
import { registerAdminEventsRoute } from './routes/adminEvents.js';
import { registerPromptsRoute } from './routes/prompts.js';
import { registerAdminAuthRoutes } from './routes/adminAuth.js';
import { registerAdminAppsRoutes } from './routes/adminApps.js';

const VERSION = process.env.npm_package_version ?? '0.0.1';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  // In production, lock CORS to the admin panel origin.
  // Set ADMIN_ORIGIN=https://admin.promptsurge.me (or Vercel preview URL) in fly secrets.
  const allowedOrigin = process.env.ADMIN_ORIGIN;
  await app.register(cors, {
    origin: allowedOrigin ?? true,
    credentials: true,
  });

  // Rate limit is opt-in per route via `config: { rateLimit: { ... } }`. We register the global
  // plugin with a generous default; auth routes override with the strict 10/min/IP cap.
  await app.register(rateLimit, {
    global: false,
    max: 1000,
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({ status: 'ok', version: VERSION }));

  await registerAdminAuthRoutes(app);
  await registerAdminAppsRoutes(app);
  await registerEventsRoute(app);
  await registerAdminEventsRoute(app);
  await registerPromptsRoute(app);

  return app;
}
