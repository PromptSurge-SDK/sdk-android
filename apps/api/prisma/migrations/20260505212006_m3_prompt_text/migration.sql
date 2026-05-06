-- CreateTable
CREATE TABLE "PromptText" (
    "id" TEXT NOT NULL,
    "appId" TEXT,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaConfirm" TEXT NOT NULL,
    "ctaDismiss" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptText_locale_idx" ON "PromptText"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "PromptText_appId_locale_key" ON "PromptText"("appId", "locale");

-- AddForeignKey
ALTER TABLE "PromptText" ADD CONSTRAINT "PromptText_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
