import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiKey, App, Developer } from '@prisma/client';
import { resolveApiKey } from './apiKeys.js';
import { resolveSession } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by [requireDeveloper]. */
    developer?: Developer;
    /** Set by [requireApp]. */
    app?: App;
    /** Set by [requireApp]. The exact ApiKey row used (could be in grace window). */
    apiKeyRow?: ApiKey;
  }
}

/**
 * Reads `Authorization: Bearer <token>`, loads the session + developer.
 * Returns 401 if missing or invalid.
 */
export async function requireDeveloper(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'missing_session' });
    return;
  }
  const token = auth.slice('Bearer '.length).trim();
  const resolved = await resolveSession(token);
  if (!resolved) {
    reply.code(401).send({ error: 'invalid_session' });
    return;
  }
  request.developer = resolved.developer;
}

/**
 * Reads `X-PromptSurge-Key`, loads the App scoped to it, attaches to request.
 * Returns 401 if missing or invalid.
 */
export async function requireApp(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const key = request.headers['x-promptsurge-key'];
  if (typeof key !== 'string' || key.length === 0) {
    reply.code(401).send({ error: 'missing_api_key' });
    return;
  }
  const resolved = await resolveApiKey(key);
  if (!resolved) {
    reply.code(401).send({ error: 'invalid_api_key' });
    return;
  }
  request.app = resolved.app;
  request.apiKeyRow = resolved.apiKey;
}
