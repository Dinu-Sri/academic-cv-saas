-- Guest publication trial allowance and first-party product journey analytics.

ALTER TABLE "guest_sessions"
  ADD COLUMN IF NOT EXISTS "publicationTaskCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "journey_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "actorType" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journey_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journey_events_createdAt_idx"
  ON "journey_events"("createdAt");
CREATE INDEX IF NOT EXISTS "journey_events_actorType_createdAt_idx"
  ON "journey_events"("actorType", "createdAt");
CREATE INDEX IF NOT EXISTS "journey_events_eventName_createdAt_idx"
  ON "journey_events"("eventName", "createdAt");
CREATE INDEX IF NOT EXISTS "journey_events_sessionId_createdAt_idx"
  ON "journey_events"("sessionId", "createdAt");
