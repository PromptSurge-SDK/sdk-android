-- M9: Billing — per-app subscription tiers (Lemon Squeezy)

CREATE TYPE "SubscriptionTier" AS ENUM ('indie', 'startup', 'growth', 'enterprise');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled', 'paused');

ALTER TABLE "App"
  ADD COLUMN "subscriptionTier"   "SubscriptionTier"   NOT NULL DEFAULT 'indie',
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "lsSubscriptionId"   TEXT,
  ADD COLUMN "lsCustomerId"       TEXT,
  ADD COLUMN "billingPeriodStart" TIMESTAMP(3),
  ADD COLUMN "billingPeriodEnd"   TIMESTAMP(3);

CREATE UNIQUE INDEX "App_lsSubscriptionId_key" ON "App"("lsSubscriptionId");
