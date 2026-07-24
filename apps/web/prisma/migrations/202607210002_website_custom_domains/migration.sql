-- Custom domains for Scholar Annual academic websites

CREATE TABLE IF NOT EXISTS "website_custom_domains" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_dns',
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "sslStatus" TEXT NOT NULL DEFAULT 'pending',
    "cloudflareHostnameId" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "redirectSubdomain" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_custom_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_custom_domains_hostname_key" ON "website_custom_domains"("hostname");
CREATE INDEX IF NOT EXISTS "website_custom_domains_websiteId_status_idx" ON "website_custom_domains"("websiteId", "status");
CREATE INDEX IF NOT EXISTS "website_custom_domains_status_lastCheckedAt_idx" ON "website_custom_domains"("status", "lastCheckedAt");

DO $$ BEGIN
  ALTER TABLE "website_custom_domains"
    ADD CONSTRAINT "website_custom_domains_websiteId_fkey"
    FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
