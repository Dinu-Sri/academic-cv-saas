CREATE TABLE IF NOT EXISTS "publication_import_batches" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceInput" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "message" TEXT NOT NULL DEFAULT '',
    "statsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "publication_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "publication_import_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawData" JSONB NOT NULL DEFAULT '{}',
    "cleanedData" JSONB NOT NULL DEFAULT '{}',
    "duplicateCandidates" JSONB NOT NULL DEFAULT '[]',
    "aiDecision" JSONB NOT NULL DEFAULT '{}',
    "duplicateEntryId" TEXT NOT NULL DEFAULT '',
    "recommendedAction" TEXT NOT NULL DEFAULT 'approve',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "publication_import_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "publication_import_batches_workspaceId_status_createdAt_idx"
    ON "publication_import_batches"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "publication_import_batches_profileId_createdAt_idx"
    ON "publication_import_batches"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "publication_import_items_batchId_status_idx"
    ON "publication_import_items"("batchId", "status");
CREATE INDEX IF NOT EXISTS "publication_import_items_workspaceId_status_createdAt_idx"
    ON "publication_import_items"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "publication_import_items_profileId_status_createdAt_idx"
    ON "publication_import_items"("profileId", "status", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publication_import_batches_workspaceId_fkey') THEN
        ALTER TABLE "publication_import_batches" ADD CONSTRAINT "publication_import_batches_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publication_import_batches_profileId_fkey') THEN
        ALTER TABLE "publication_import_batches" ADD CONSTRAINT "publication_import_batches_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publication_import_items_batchId_fkey') THEN
        ALTER TABLE "publication_import_items" ADD CONSTRAINT "publication_import_items_batchId_fkey"
            FOREIGN KEY ("batchId") REFERENCES "publication_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publication_import_items_workspaceId_fkey') THEN
        ALTER TABLE "publication_import_items" ADD CONSTRAINT "publication_import_items_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publication_import_items_profileId_fkey') THEN
        ALTER TABLE "publication_import_items" ADD CONSTRAINT "publication_import_items_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
