CREATE TABLE IF NOT EXISTS "cv_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "engine" TEXT NOT NULL DEFAULT 'tectonic',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cv_templates_key_key" ON "cv_templates"("key");

INSERT INTO "cv_templates" ("id", "key", "name", "description", "engine", "version", "isActive", "isDefault", "updatedAt")
VALUES (
    'classic',
    'classic',
    'Classic Academic',
    'Clean academic CV with traditional section hierarchy.',
    'tectonic',
    '1.0.0',
    true,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "engine" = EXCLUDED."engine",
    "version" = EXCLUDED."version",
    "isActive" = EXCLUDED."isActive",
    "isDefault" = EXCLUDED."isDefault",
    "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "file_assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT,
    "documentId" TEXT,
    "kind" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "bucket" TEXT NOT NULL DEFAULT '',
    "objectKey" TEXT NOT NULL DEFAULT '',
    "localPath" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "checksumSha256" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "file_assets_workspaceId_kind_createdAt_idx" ON "file_assets"("workspaceId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "file_assets_profileId_idx" ON "file_assets"("profileId");
CREATE INDEX IF NOT EXISTS "file_assets_documentId_idx" ON "file_assets"("documentId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_assets_workspaceId_fkey') THEN
        ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_assets_profileId_fkey') THEN
        ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_assets_documentId_fkey') THEN
        ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_documentId_fkey"
        FOREIGN KEY ("documentId") REFERENCES "cv_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "pdf_render_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileAssetId" TEXT,
    "templateKey" TEXT NOT NULL DEFAULT 'classic',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "message" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "inputHash" TEXT NOT NULL DEFAULT '',
    "templateVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pdf_render_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pdf_render_jobs_workspaceId_status_createdAt_idx" ON "pdf_render_jobs"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "pdf_render_jobs_profileId_createdAt_idx" ON "pdf_render_jobs"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "pdf_render_jobs_documentId_createdAt_idx" ON "pdf_render_jobs"("documentId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_render_jobs_workspaceId_fkey') THEN
        ALTER TABLE "pdf_render_jobs" ADD CONSTRAINT "pdf_render_jobs_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_render_jobs_profileId_fkey') THEN
        ALTER TABLE "pdf_render_jobs" ADD CONSTRAINT "pdf_render_jobs_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_render_jobs_documentId_fkey') THEN
        ALTER TABLE "pdf_render_jobs" ADD CONSTRAINT "pdf_render_jobs_documentId_fkey"
        FOREIGN KEY ("documentId") REFERENCES "cv_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_render_jobs_fileAssetId_fkey') THEN
        ALTER TABLE "pdf_render_jobs" ADD CONSTRAINT "pdf_render_jobs_fileAssetId_fkey"
        FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
