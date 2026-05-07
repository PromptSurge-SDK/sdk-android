-- M9 Teams: Organization, OrganizationMember, OrganizationInvite
-- Also adds organizationId to App.
-- Data migration: one auto-org per existing Developer, apps linked to it.

CREATE TYPE "OrgRole" AS ENUM ('owner', 'member');

CREATE TABLE "Organization" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMember" (
  "id"             TEXT        NOT NULL,
  "organizationId" TEXT        NOT NULL,
  "developerId"    TEXT        NOT NULL,
  "role"           "OrgRole"   NOT NULL DEFAULT 'member',
  "joinedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInvite" (
  "id"             TEXT        NOT NULL,
  "organizationId" TEXT        NOT NULL,
  "email"          TEXT        NOT NULL,
  "role"           "OrgRole"   NOT NULL DEFAULT 'member',
  "token"          TEXT        NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "acceptedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "App" ADD COLUMN "organizationId" TEXT;

-- Indexes
CREATE UNIQUE INDEX "OrganizationMember_organizationId_developerId_key"
  ON "OrganizationMember"("organizationId", "developerId");
CREATE INDEX "OrganizationMember_developerId_idx"
  ON "OrganizationMember"("developerId");
CREATE UNIQUE INDEX "OrganizationInvite_token_key"
  ON "OrganizationInvite"("token");
CREATE INDEX "OrganizationInvite_organizationId_idx"
  ON "OrganizationInvite"("organizationId");
CREATE INDEX "App_organizationId_idx"
  ON "App"("organizationId");

-- Foreign keys
ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrganizationMember_developerId_fkey"
    FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvite"
  ADD CONSTRAINT "OrganizationInvite_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "App"
  ADD CONSTRAINT "App_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Data migration ────────────────────────────────────────────────────────────
-- For every existing Developer, create one Organization (named after their email
-- prefix), make them the owner, and assign all their Apps to it.
DO $$
DECLARE
  dev     RECORD;
  org_id  TEXT;
BEGIN
  FOR dev IN SELECT id, email FROM "Developer" LOOP
    org_id := 'org_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO "Organization" ("id", "name", "createdAt")
      VALUES (org_id, split_part(dev.email, '@', 1), NOW());
    INSERT INTO "OrganizationMember" ("id", "organizationId", "developerId", "role", "joinedAt")
      VALUES ('mem_' || replace(gen_random_uuid()::text, '-', ''), org_id, dev.id, 'owner', NOW());
    UPDATE "App" SET "organizationId" = org_id WHERE "developerId" = dev.id;
  END LOOP;
END;
$$;
