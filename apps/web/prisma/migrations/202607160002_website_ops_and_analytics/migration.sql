-- Website ops: blocking + privacy-safe daily metrics

ALTER TABLE "academic_websites" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
ALTER TABLE "academic_websites" ADD COLUMN IF NOT EXISTS "blockedReason" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "academic_websites_blockedAt_idx" ON "academic_websites"("blockedAt");

CREATE TABLE IF NOT EXISTS "website_daily_metrics" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "pagePath" TEXT NOT NULL DEFAULT '/',
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_daily_metrics_websiteId_metricDate_pagePath_key"
  ON "website_daily_metrics"("websiteId", "metricDate", "pagePath");
CREATE INDEX IF NOT EXISTS "website_daily_metrics_websiteId_metricDate_idx"
  ON "website_daily_metrics"("websiteId", "metricDate");

DO $$ BEGIN
  ALTER TABLE "website_daily_metrics"
    ADD CONSTRAINT "website_daily_metrics_websiteId_fkey"
    FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
