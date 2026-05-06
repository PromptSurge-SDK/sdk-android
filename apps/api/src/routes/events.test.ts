import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/passwords.js';
import { generateApiKey } from '../auth/tokens.js';

const TEST_EMAIL = 'events-vitest@promptsurge.test';
const TEST_API_KEY = generateApiKey();

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'pre_prompt_shown',
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId: randomUUID(),
    deviceId: 'device-hash-123',
    appVersion: '1.0.0',
    sdkVersion: '0.0.1',
    locale: 'en-US',
    platform: 'android',
    payload: {},
    ...overrides,
  };
}

describe('POST /v1/events', () => {
  let app: FastifyInstance;
  let appId: string;
  let developerId: string;

  beforeAll(async () => {
    app = await buildApp();
    const developer = await prisma.developer.upsert({
      where: { email: TEST_EMAIL },
      update: {},
      create: { email: TEST_EMAIL, passwordHash: await hashPassword('vitest-pwd') },
    });
    developerId = developer.id;
    const created = await prisma.app.create({
      data: { name: 'Vitest Events App', developerId: developer.id },
    });
    appId = created.id;
    await prisma.apiKey.create({ data: { appId, key: TEST_API_KEY } });
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { appId } });
    await prisma.apiKey.deleteMany({ where: { appId } });
    await prisma.app.delete({ where: { id: appId } }).catch(() => {});
    await prisma.developer.delete({ where: { id: developerId } }).catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.event.deleteMany({ where: { appId } });
  });

  it('accepts a valid batch and returns 202 (happy path)', async () => {
    const events = [makeEvent(), makeEvent({ eventType: 'pre_prompt_confirmed' })];
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': TEST_API_KEY },
      payload: { events },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 2, skipped: 0 });

    const stored = await prisma.event.findMany({ where: { appId } });
    expect(stored).toHaveLength(2);
  });

  it('extracts payload.resolvedLocale into the resolvedLocale column', async () => {
    const events = [
      makeEvent({ eventType: 'pre_prompt_shown', payload: { resolvedLocale: 'de' } }),
      makeEvent({ eventType: 'first_open', payload: {} }),
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': TEST_API_KEY },
      payload: { events },
    });
    expect(res.statusCode).toBe(202);

    const stored = await prisma.event.findMany({ where: { appId }, orderBy: { eventType: 'asc' } });
    const firstOpen = stored.find((s) => s.eventType === 'first_open');
    const shown = stored.find((s) => s.eventType === 'pre_prompt_shown');
    expect(firstOpen?.resolvedLocale).toBeNull();
    expect(shown?.resolvedLocale).toBe('de');
  });

  it('returns 401 when api key header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: { events: [makeEvent()] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('missing_api_key');
  });

  it('returns 401 when api key is unknown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': 'nope-not-real' },
      payload: { events: [makeEvent()] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_api_key');
  });

  it('returns 401 when api key is revoked in the past', async () => {
    const revoked = generateApiKey();
    const row = await prisma.apiKey.create({
      data: { appId, key: revoked, revokedAt: new Date(Date.now() - 1000) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': revoked },
      payload: { events: [makeEvent()] },
    });
    expect(res.statusCode).toBe(401);
    await prisma.apiKey.delete({ where: { id: row.id } });
  });

  it('accepts a key whose revokedAt is still in the future (grace window)', async () => {
    const grace = generateApiKey();
    const row = await prisma.apiKey.create({
      data: { appId, key: grace, revokedAt: new Date(Date.now() + 60_000) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': grace },
      payload: { events: [makeEvent()] },
    });
    expect(res.statusCode).toBe(202);
    await prisma.apiKey.delete({ where: { id: row.id } });
  });

  it('returns 400 on malformed body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': TEST_API_KEY },
      payload: { events: [{ eventType: 'pre_prompt_shown' }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_batch');
  });

  it('returns 400 on unknown eventType', async () => {
    const bad = makeEvent({ eventType: 'something_else' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': TEST_API_KEY },
      payload: { events: [bad] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('is idempotent on duplicate eventId', async () => {
    const event = makeEvent();
    const first = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': TEST_API_KEY },
      payload: { events: [event] },
    });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual({ accepted: 1, skipped: 0 });

    const second = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': TEST_API_KEY },
      payload: { events: [event] },
    });
    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual({ accepted: 0, skipped: 1 });

    const stored = await prisma.event.findMany({ where: { appId } });
    expect(stored).toHaveLength(1);
  });
});
