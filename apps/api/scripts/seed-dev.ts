/**
 * Idempotent seed: ensures `dev@promptsurge.test / password123` exists with one app and a single
 * active API key. Prints the API key so the sample app can use it.
 *
 * Behavior:
 *   - If the developer exists, leave them alone.
 *   - Use the existing Sample App if present (the M1/M2/M3 seeded one survives the M4 migration
 *     under the same default developer); otherwise create a new one.
 *   - Mint a fresh `ps_live_` key on every run and print it. Old keys are NOT auto-revoked here
 *     because the M4 migration intentionally preserves the legacy `test-api-key-m1` key in a
 *     grace state — run the rotate endpoint or revoke it manually if you want it gone.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const EMAIL = 'dev@promptsurge.test';
const PASSWORD = 'password123';

async function main() {
  const dev = await prisma.developer.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      id: 'seed_dev_default',
      email: EMAIL,
      passwordHash: await argonHash(PASSWORD),
    },
  });

  let app = await prisma.app.findFirst({ where: { developerId: dev.id }, orderBy: { createdAt: 'asc' } });
  if (!app) {
    app = await prisma.app.create({ data: { name: 'Sample App (M1)', developerId: dev.id } });
  }

  const key = `ps_live_${randomBytes(24).toString('base64url')}`;
  const created = await prisma.apiKey.create({ data: { appId: app.id, key } });

  // eslint-disable-next-line no-console
  console.log('---');
  // eslint-disable-next-line no-console
  console.log(`Developer: ${EMAIL}  password=${PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`App:       ${app.name}  (id=${app.id})`);
  // eslint-disable-next-line no-console
  console.log(`API key:   ${created.key}`);
  // eslint-disable-next-line no-console
  console.log('---');
  // eslint-disable-next-line no-console
  console.log('Paste this key into packages/sample-app-android/app/.../MainActivity.kt and rebuild.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
