import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';

const EMAIL_A = `m4-a-${Date.now()}-${randomUUID().slice(0, 8)}@promptsurge.test`;
const EMAIL_B = `m4-b-${Date.now()}-${randomUUID().slice(0, 8)}@promptsurge.test`;

interface SignupResponse {
  token: string;
  developer: { id: string; email: string };
}

describe('M4 auth + cross-tenant isolation', () => {
  let app: FastifyInstance;
  const cleanupEmails: string[] = [EMAIL_A, EMAIL_B];

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    for (const email of cleanupEmails) {
      const dev = await prisma.developer.findUnique({ where: { email } });
      if (dev) {
        await prisma.developer.delete({ where: { id: dev.id } }).catch(() => {});
      }
    }
    await app.close();
    await prisma.$disconnect();
  });

  async function signup(email: string, password = 'password123'): Promise<SignupResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/signup',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  async function createApp(token: string, name: string): Promise<{ appId: string; key: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/apps',
      headers: { authorization: `Bearer ${token}` },
      payload: { name },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    return { appId: body.app.id, key: body.apiKey.key };
  }

  it('signup happy path returns a session token + developer', async () => {
    const body = await signup(EMAIL_A);
    expect(body.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.developer.email).toBe(EMAIL_A.toLowerCase());
  });

  it('rejects duplicate email with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/signup',
      payload: { email: EMAIL_A, password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('email_in_use');
  });

  it('login with correct password returns 200 + new token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { email: EMAIL_A, password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
  });

  it('login with wrong password returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { email: EMAIL_A, password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('login with unknown email returns 401 (not 404 — no user enumeration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { email: 'no-such@promptsurge.test', password: 'whatever' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /admin/me returns current developer when bearer is valid', async () => {
    const { token } = await signup(`me-${EMAIL_A}`);
    cleanupEmails.push(`me-${EMAIL_A}`);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe(`me-${EMAIL_A}`.toLowerCase());
  });

  it('GET /admin/me returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/me' });
    expect(res.statusCode).toBe(401);
  });

  it('cross-tenant: developer A cannot read developer B events via /admin/events', async () => {
    const a = await signup(EMAIL_B); // EMAIL_B used for "developer A" here
    const aApp = await createApp(a.token, 'A app');
    const bEmail = `cross-${EMAIL_B}`;
    cleanupEmails.push(bEmail);
    const b = await signup(bEmail);
    const bApp = await createApp(b.token, 'B app');

    // Ingest one event under B's API key.
    const ingest = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': bApp.key },
      payload: {
        events: [
          {
            eventType: 'first_open',
            eventId: randomUUID(),
            timestamp: new Date().toISOString(),
            sessionId: randomUUID(),
            deviceId: 'device-X',
            appVersion: '1.0',
            sdkVersion: '0.0.1',
            locale: 'en-US',
            platform: 'android',
            payload: {},
          },
        ],
      },
    });
    expect(ingest.statusCode).toBe(202);

    // Developer A reading their own /admin/events should NOT see B's row.
    const aSees = await app.inject({
      method: 'GET',
      url: '/admin/events',
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(aSees.statusCode).toBe(200);
    const aDeviceIds = aSees.json().events.map((e: { deviceId: string }) => e.deviceId);
    expect(aDeviceIds).not.toContain('device-X');

    // And A using their own apiKey on /v1/events for B's appId should be irrelevant —
    // /v1/events writes are scoped by the apiKey lookup, so this is implicitly safe. We instead
    // assert the inverse: A's key does NOT resolve to B's app.
    const wrongRead = await app.inject({
      method: 'GET',
      url: `/admin/events?appId=${bApp.appId}`,
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(wrongRead.statusCode).toBe(200);
    expect(wrongRead.json().events).toHaveLength(0); // appId filter combined with developerId means: zero rows
  });

  it('rotate keys: old key works during grace, new key works immediately', async () => {
    const { token } = await signup(`rotate-${EMAIL_B}`);
    cleanupEmails.push(`rotate-${EMAIL_B}`);
    const created = await createApp(token, 'rotate app');

    // Rotate
    const rot = await app.inject({
      method: 'POST',
      url: `/admin/apps/${created.appId}/keys/rotate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rot.statusCode).toBe(200);
    const fresh = rot.json().apiKey.key as string;

    // New key works
    const newOk = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': fresh },
      payload: { events: [makeEv()] },
    });
    expect(newOk.statusCode).toBe(202);

    // Old key still works during 7-day grace window
    const oldOk = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-promptsurge-key': created.key },
      payload: { events: [makeEv()] },
    });
    expect(oldOk.statusCode).toBe(202);
  });
});

function makeEv() {
  return {
    eventType: 'first_open',
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId: randomUUID(),
    deviceId: 'device-rotate',
    appVersion: '1.0',
    sdkVersion: '0.0.1',
    locale: 'en-US',
    platform: 'android',
    payload: {},
  };
}
