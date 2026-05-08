-- M13: add first/last name to Developer for team management clarity
ALTER TABLE "Developer" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Developer" ADD COLUMN "lastName" TEXT;
