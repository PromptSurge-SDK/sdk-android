import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/passwords.js';
import { generateApiKey } from '../auth/tokens.js';

const TEST_EMAIL = 'prompts-vitest@promptsurge.test';
const TEST_API_KEY = generateApiKey();

describe('GET /v1/prompts', () => {
  let app: FastifyInstance;
  let appId: string;
  let developerId: string;

  beforeAll(async () => {
    app = await buildApp();
    const dev = await prisma.developer.upsert({
      where: { email: TEST_EMAIL },
      update: {},
      create: { email: TEST_EMAIL, passwordHash: await hashPassword('vitest-pwd') },
    });
    developerId = dev.id;
    const created = await prisma.app.create({
      data: { name: 'Vitest Prompts App', developerId: dev.id },
    });
    appId = created.id;
    await prisma.apiKey.create({ data: { appId, key: TEST_API_KEY } });

    await prisma.promptText.deleteMany({ where: { appId } });
    const globalLocales = ['en', 'de', 'fr'];
    for (const l of globalLocales) {
      const exists = await prisma.promptText.findFirst({ where: { appId: null, locale: l } });
      if (!exists) {
        await prisma.promptText.create({
          data: {
            appId: null,
            locale: l,
            title: `T-${l}`,
            body: `B-${l}`,
            ctaConfirm: `C-${l}`,
            ctaDismiss: `D-${l}`,
          },
        });
      }
    }
    await prisma.promptText.create({
      data: {
        appId,
        locale: 'de',
        title: 'app-de-title',
        body: 'app-de-body',
        ctaConfirm: 'app-de-yes',
        ctaDismiss: 'app-de-no',
      },
    });
  });

  afterAll(async () => {
    await prisma.promptText.deleteMany({ where: { appId } });
    await prisma.apiKey.deleteMany({ where: { appId } });
    await prisma.app.delete({ where: { id: appId } }).catch(() => {});
    await prisma.developer.delete({ where: { id: developerId } }).catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  async function get(locale: string, key: string = TEST_API_KEY) {
    return app.inject({
      method: 'GET',
      url: `/v1/prompts?locale=${encodeURIComponent(locale)}`,
      headers: key ? { 'x-promptsurge-key': key } : {},
    });
  }

  it('returns app-specific exact match when present', async () => {
    const res = await get('de');
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('app-de-title');
    expect(res.json().locale).toBe('de');
  });

  it('falls back from regional to language-only globally (fr-CA → fr)', async () => {
    const res = await get('fr-CA');
    expect(res.statusCode).toBe(200);
    expect(res.json().locale).toBe('fr');
  });

  it('falls back to global en when locale is unknown (ko)', async () => {
    const res = await get('ko');
    expect(res.statusCode).toBe(200);
    expect(res.json().locale).toBe('en');
  });

  it('exact global match wins over en fallback', async () => {
    const res = await get('en');
    expect(res.statusCode).toBe(200);
    expect(res.json().locale).toBe('en');
  });

  it('returns 401 when api key is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/prompts?locale=en' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when api key is unknown', async () => {
    const res = await get('en', 'nope');
    expect(res.statusCode).toBe(401);
  });
});
