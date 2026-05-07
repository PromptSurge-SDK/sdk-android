import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { registerEventsRoute } from './routes/events.js';
import { registerAdminEventsRoute } from './routes/adminEvents.js';
import { registerPromptsRoute } from './routes/prompts.js';
import { registerAdminAuthRoutes } from './routes/adminAuth.js';
import { registerAdminAppsRoutes } from './routes/adminApps.js';
import { registerAdminPromptsRoutes } from './routes/adminPrompts.js';
import { registerAdminKeywordsRoutes } from './routes/adminKeywords.js';
import { registerAdminLlmConfigRoutes } from './routes/adminLlmConfig.js';
import { registerAdminLlmUsageRoutes } from './routes/adminLlmUsage.js';
import { registerAdminUploadsRoutes } from './routes/adminUploads.js';
import { registerAdminThemesRoutes } from './routes/adminThemes.js';
import { registerAdminMetricsRoutes } from './routes/adminMetrics.js';
import { registerLsWebhookRoute } from './routes/lemonSqueezy.js';
import { registerAdminSubscriptionRoutes } from './routes/adminSubscription.js';
import { registerAdminOrgRoutes } from './routes/adminOrg.js';
import { registerAdminInviteRoutes } from './routes/adminInvite.js';
import { registerAdminAccountRoutes } from './routes/adminAccount.js';

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

  const allowedOrigin = process.env.ADMIN_ORIGIN;
  await app.register(cors, {
    origin: allowedOrigin ?? true,
    credentials: true,
  });

  await app.register(rateLimit, {
    global: false,
    max: 1000,
    timeWindow: '1 minute',
  });

  // Multipart support for image uploads (2 MB limit)
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });

  app.get('/health', async () => ({ status: 'ok', version: VERSION }));

  await registerAdminAuthRoutes(app);
  await registerAdminAppsRoutes(app);
  await registerAdminPromptsRoutes(app);
  await registerAdminKeywordsRoutes(app);
  await registerAdminLlmConfigRoutes(app);
  await registerAdminLlmUsageRoutes(app);
  await registerAdminUploadsRoutes(app);
  await registerAdminThemesRoutes(app);
  await registerAdminMetricsRoutes(app);
  await registerAdminSubscriptionRoutes(app);
  await registerAdminOrgRoutes(app);
  await registerAdminInviteRoutes(app);
  await registerAdminAccountRoutes(app);
  // Webhook route registered as a scoped plugin (has its own content-type parser)
  await app.register(registerLsWebhookRoute);
  await registerEventsRoute(app);
  await registerAdminEventsRoute(app);
  await registerPromptsRoute(app);

  return app;
}
