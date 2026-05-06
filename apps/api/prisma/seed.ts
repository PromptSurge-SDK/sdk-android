import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GLOBAL_PROMPTS: Array<{
  locale: string;
  title: string;
  body: string;
  ctaConfirm: string;
  ctaDismiss: string;
}> = [
  {
    locale: 'en',
    title: 'Enjoying this app?',
    body: 'Reviews help other people discover apps like this. Got a moment?',
    ctaConfirm: 'Sure',
    ctaDismiss: 'Not now',
  },
  // review needed — natural translation, verify with native speaker before launch
  {
    locale: 'de',
    title: 'Gefällt dir diese App?',
    body: 'Bewertungen helfen anderen, ähnliche Apps zu entdecken. Hast du einen Moment?',
    ctaConfirm: 'Klar',
    ctaDismiss: 'Später',
  },
  // review needed — natural translation, verify with native speaker before launch
  {
    locale: 'es',
    title: '¿Te gusta esta app?',
    body: 'Las reseñas ayudan a que otras personas descubran apps como esta. ¿Tienes un momento?',
    ctaConfirm: 'Claro',
    ctaDismiss: 'Ahora no',
  },
  // review needed — natural translation, verify with native speaker before launch
  {
    locale: 'fr',
    title: 'Vous aimez cette application ?',
    body: "Les avis aident d'autres personnes à découvrir des applications comme celle-ci. Vous avez un instant ?",
    ctaConfirm: 'Bien sûr',
    ctaDismiss: 'Plus tard',
  },
  // review needed — natural translation, verify with native speaker before launch
  {
    locale: 'ja',
    title: 'このアプリは気に入っていますか？',
    body: 'レビューは、こうしたアプリを見つけるのに役立ちます。少しお時間いただけますか？',
    ctaConfirm: 'はい',
    ctaDismiss: '今はやめておく',
  },
];

async function main() {
  const apiKey = 'test-api-key-m1';
  await prisma.app.upsert({
    where: { apiKey },
    update: {},
    create: { apiKey, name: 'Sample App (M1)' },
  });
  // eslint-disable-next-line no-console
  console.log(`Seeded App with apiKey=${apiKey}`);

  // Globals have appId=null, so the (appId, locale) compound unique key doesn't give us
  // a clean upsert handle (Postgres treats NULLs in unique indexes as distinct). Find by
  // (locale, appId IS NULL) and create-or-update manually.
  for (const p of GLOBAL_PROMPTS) {
    const existing = await prisma.promptText.findFirst({
      where: { appId: null, locale: p.locale },
    });
    if (existing) {
      await prisma.promptText.update({
        where: { id: existing.id },
        data: {
          title: p.title,
          body: p.body,
          ctaConfirm: p.ctaConfirm,
          ctaDismiss: p.ctaDismiss,
        },
      });
    } else {
      await prisma.promptText.create({
        data: {
          appId: null,
          locale: p.locale,
          title: p.title,
          body: p.body,
          ctaConfirm: p.ctaConfirm,
          ctaDismiss: p.ctaDismiss,
        },
      });
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${GLOBAL_PROMPTS.length} global PromptText rows`);
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
