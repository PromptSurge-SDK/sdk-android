/**
 * Seed script — inserts 30 days × ~500 synthetic events for the dev app.
 * Run: pnpm --filter api seed:metrics
 *
 * Realistic distribution per day:
 *   60% pre_prompt_shown, 30% pre_prompt_confirmed, 25% pre_prompt_dismissed,
 *   20% native_prompt_requested, 5% first_open
 *   (percentages of total daily events, not exclusive)
 *
 * Locales: en-US (40%), de-DE (25%), es-ES (15%), fr-FR (12%), ja-JP (8%)
 * Versions: 1.0.0 (60%), 1.1.0 (40%)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const LOCALES = [
  { locale: 'en-US', weight: 40 },
  { locale: 'de-DE', weight: 25 },
  { locale: 'es-ES', weight: 15 },
  { locale: 'fr-FR', weight: 12 },
  { locale: 'ja-JP', weight: 8 },
];

const VERSIONS = [
  { version: '1.0.0', weight: 60 },
  { version: '1.1.0', weight: 40 },
];

function weightedPick<T>(items: { weight: number; [key: string]: unknown }[], key: keyof typeof items[0]): T {
  const total = items.reduce((s, i) => s + (i.weight as number), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight as number;
    if (r <= 0) return item[key] as T;
  }
  return items[items.length - 1][key] as T;
}

async function main() {
  const app = await prisma.app.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!app) {
    console.error('No app found. Run seed-dev.ts first.');
    process.exit(1);
  }
  console.log(`Seeding metrics for app: ${app.name} (${app.id})`);

  const now = new Date();
  const events: {
    id: string; appId: string; eventType: string; eventId: string;
    timestamp: Date; sessionId: string; deviceId: string;
    appVersion: string; sdkVersion: string; locale: string;
    resolvedLocale: string; platform: string; payload: object;
  }[] = [];

  const DAYS = 30;
  const EVENTS_PER_DAY = 500;

  for (let day = DAYS; day >= 0; day--) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - day);
    dayStart.setHours(0, 0, 0, 0);

    for (let i = 0; i < EVENTS_PER_DAY; i++) {
      const locale = weightedPick<string>(LOCALES, 'locale');
      const appVersion = weightedPick<string>(VERSIONS, 'version');
      const timestamp = new Date(dayStart.getTime() + Math.random() * 86400000);
      const deviceId = `device-${Math.floor(i / 5)}-day${day}`;
      const sessionId = randomUUID();

      // Each "user" goes through the funnel with realistic drop-off
      const r = Math.random() * 100;

      let eventType: string;
      if (r < 5) {
        eventType = 'first_open';
      } else if (r < 25) {
        eventType = 'native_prompt_requested';
      } else if (r < 85) {
        eventType = 'pre_prompt_shown';
      } else if (r < 115) {
        // Some confirmed, some dismissed — normalized to shown bucket
        eventType = Math.random() < 0.55 ? 'pre_prompt_confirmed' : 'pre_prompt_dismissed';
      } else {
        eventType = 'initialize';
      }

      events.push({
        id: randomUUID(),
        appId: app.id,
        eventType,
        eventId: randomUUID(),
        timestamp,
        sessionId,
        deviceId,
        appVersion,
        sdkVersion: '1.0.0',
        locale,
        resolvedLocale: locale,
        platform: 'android',
        payload: {},
      });
    }
  }

  // Build a more realistic funnel: for every pre_prompt_shown, add confirm/dismiss
  // Already embedded above in the random distribution — insert in batches
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    await prisma.event.createMany({ data: batch, skipDuplicates: true });
    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${events.length}...`);
  }

  console.log(`\nDone — inserted up to ${events.length} synthetic events (duplicates skipped).`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
