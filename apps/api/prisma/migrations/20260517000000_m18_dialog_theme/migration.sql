-- CreateTable: AppDialogTheme
CREATE TABLE "AppDialogTheme" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL DEFAULT 'default',
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "buttonTextColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppDialogTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppDialogTheme_appId_key" ON "AppDialogTheme"("appId");

ALTER TABLE "AppDialogTheme" ADD CONSTRAINT "AppDialogTheme_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
