CREATE TABLE IF NOT EXISTS "cv_import_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileAssetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'uploaded',
    "message" TEXT NOT NULL DEFAULT '',
    "sourceFilename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "draftJson" JSONB NOT NULL DEFAULT '{}',
    "statsJson" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT NOT NULL DEFAULT '',
    "mergeResult" JSONB NOT NULL DEFAULT '{}',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cv_import_jobs_workspaceId_status_createdAt_idx" ON "cv_import_jobs"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_import_jobs_profileId_createdAt_idx" ON "cv_import_jobs"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_import_jobs_fileAssetId_idx" ON "cv_import_jobs"("fileAssetId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_import_jobs_workspaceId_fkey') THEN
        ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_import_jobs_profileId_fkey') THEN
        ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_import_jobs_fileAssetId_fkey') THEN
        ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_fileAssetId_fkey"
            FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
