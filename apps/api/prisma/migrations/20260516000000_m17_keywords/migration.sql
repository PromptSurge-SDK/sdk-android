-- CreateEnum
CREATE TYPE "KeywordAction" AS ENUM ('added', 'removed');

-- CreateTable: BannedKeyword
CREATE TABLE "BannedKeyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BannedKeyword_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BannedKeyword_keyword_key" ON "BannedKeyword"("keyword");

-- CreateTable: KeywordAuditLog
CREATE TABLE "KeywordAuditLog" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "action" "KeywordAction" NOT NULL,
    "type" "KeywordType" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByEmail" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeywordAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KeywordAuditLog_appId_changedAt_idx" ON "KeywordAuditLog"("appId", "changedAt");

-- AddForeignKey
ALTER TABLE "KeywordAuditLog" ADD CONSTRAINT "KeywordAuditLog_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: initial banned keywords (review-gaming and store-policy terms)
INSERT INTO "BannedKeyword" ("id", "keyword") VALUES
    (gen_random_uuid()::text, '5 star'),
    (gen_random_uuid()::text, '5-star'),
    (gen_random_uuid()::text, 'five star'),
    (gen_random_uuid()::text, 'five stars'),
    (gen_random_uuid()::text, 'rate us'),
    (gen_random_uuid()::text, 'leave a review'),
    (gen_random_uuid()::text, 'positive review'),
    (gen_random_uuid()::text, 'good review'),
    (gen_random_uuid()::text, 'google play'),
    (gen_random_uuid()::text, 'play store'),
    (gen_random_uuid()::text, 'app store'),
    (gen_random_uuid()::text, 'rate our app');
