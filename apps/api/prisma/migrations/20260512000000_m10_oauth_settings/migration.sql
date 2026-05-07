-- M10: OAuth accounts + nullable passwordHash
-- Allow passwordHash to be null (OAuth-only accounts have no password)
ALTER TABLE "Developer" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Linked OAuth provider accounts
CREATE TABLE "OAuthAccount" (
  "id"                TEXT NOT NULL,
  "developerId"       TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthAccount_developer_fkey"
    FOREIGN KEY ("developerId") REFERENCES "Developer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key"
  ON "OAuthAccount"("provider", "providerAccountId");

CREATE INDEX "OAuthAccount_developerId_idx"
  ON "OAuthAccount"("developerId");
