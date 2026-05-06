-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "sdkVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "App_apiKey_key" ON "App"("apiKey");

-- CreateIndex
CREATE INDEX "App_apiKey_idx" ON "App"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventId_key" ON "Event"("eventId");

-- CreateIndex
CREATE INDEX "Event_appId_eventType_timestamp_idx" ON "Event"("appId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "Event_appId_deviceId_timestamp_idx" ON "Event"("appId", "deviceId", "timestamp");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
