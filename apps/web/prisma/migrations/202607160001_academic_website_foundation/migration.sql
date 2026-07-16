-- Academic website foundation (Phase 1)

CREATE TABLE IF NOT EXISTS "academic_websites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "templateKey" TEXT NOT NULL DEFAULT 'modern-scholar',
    "headlineOverride" TEXT NOT NULL DEFAULT '',
    "pageContentJson" JSONB NOT NULL DEFAULT '{}',
    "enabledPagesJson" JSONB NOT NULL DEFAULT '{}',
    "navigationJson" JSONB NOT NULL DEFAULT '[]',
    "sectionVisibilityJson" JSONB NOT NULL DEFAULT '{}',
    "fieldVisibilityJson" JSONB NOT NULL DEFAULT '{}',
    "featuredContentJson" JSONB NOT NULL DEFAULT '{}',
    "appearanceJson" JSONB NOT NULL DEFAULT '{}',
    "seoJson" JSONB NOT NULL DEFAULT '{}',
    "sourceCvDocumentId" TEXT,
    "currentSnapshotId" TEXT,
    "draftSourceVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "searchIndexingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contactFormEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_websites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_websites_profileId_key" ON "academic_websites"("profileId");
CREATE UNIQUE INDEX IF NOT EXISTS "academic_websites_username_key" ON "academic_websites"("username");
CREATE INDEX IF NOT EXISTS "academic_websites_workspaceId_status_updatedAt_idx" ON "academic_websites"("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "academic_websites_profileId_status_idx" ON "academic_websites"("profileId", "status");
CREATE INDEX IF NOT EXISTS "academic_websites_username_status_idx" ON "academic_websites"("username", "status");

CREATE TABLE IF NOT EXISTS "website_snapshots" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "snapshotJson" JSONB NOT NULL DEFAULT '{}',
    "sourceProfileVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceCvVersion" INTEGER,
    "checksumSha256" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "website_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_snapshots_websiteId_version_key" ON "website_snapshots"("websiteId", "version");
CREATE INDEX IF NOT EXISTS "website_snapshots_websiteId_status_publishedAt_idx" ON "website_snapshots"("websiteId", "status", "publishedAt");

CREATE TABLE IF NOT EXISTS "website_redirects" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "oldUsername" TEXT NOT NULL,
    "newUsername" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "website_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_redirects_oldUsername_key" ON "website_redirects"("oldUsername");
CREATE INDEX IF NOT EXISTS "website_redirects_websiteId_status_idx" ON "website_redirects"("websiteId", "status");

CREATE TABLE IF NOT EXISTS "website_publish_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "message" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL,
    "expectedVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshotId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "website_publish_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_publish_jobs_idempotencyKey_key" ON "website_publish_jobs"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "website_publish_jobs_workspaceId_status_createdAt_idx" ON "website_publish_jobs"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "website_publish_jobs_websiteId_status_createdAt_idx" ON "website_publish_jobs"("websiteId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "website_contact_messages" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "ipHash" TEXT NOT NULL DEFAULT '',
    "userAgentHash" TEXT NOT NULL DEFAULT '',
    "spamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "turnstileValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "website_contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "website_contact_messages_websiteId_status_createdAt_idx" ON "website_contact_messages"("websiteId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "website_contact_messages_workspaceId_createdAt_idx" ON "website_contact_messages"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "website_revisions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "proposalId" TEXT,
    "action" TEXT NOT NULL,
    "targetField" TEXT NOT NULL DEFAULT '',
    "beforeJson" JSONB NOT NULL DEFAULT '{}',
    "afterJson" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "website_revisions_workspaceId_createdAt_idx" ON "website_revisions"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "website_revisions_websiteId_createdAt_idx" ON "website_revisions"("websiteId", "createdAt");
CREATE INDEX IF NOT EXISTS "website_revisions_proposalId_idx" ON "website_revisions"("proposalId");

DO $$ BEGIN
  ALTER TABLE "academic_websites" ADD CONSTRAINT "academic_websites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic_websites" ADD CONSTRAINT "academic_websites_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic_websites" ADD CONSTRAINT "academic_websites_sourceCvDocumentId_fkey" FOREIGN KEY ("sourceCvDocumentId") REFERENCES "cv_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_snapshots" ADD CONSTRAINT "website_snapshots_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_redirects" ADD CONSTRAINT "website_redirects_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_publish_jobs" ADD CONSTRAINT "website_publish_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_publish_jobs" ADD CONSTRAINT "website_publish_jobs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_publish_jobs" ADD CONSTRAINT "website_publish_jobs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_contact_messages" ADD CONSTRAINT "website_contact_messages_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_contact_messages" ADD CONSTRAINT "website_contact_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_contact_messages" ADD CONSTRAINT "website_contact_messages_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_revisions" ADD CONSTRAINT "website_revisions_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "academic_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_revisions" ADD CONSTRAINT "website_revisions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "website_revisions" ADD CONSTRAINT "website_revisions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
