ALTER TABLE "profile_sections"
ADD COLUMN IF NOT EXISTS "sectionOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "profile_section_entries" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "entryOrder" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profile_section_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "profile_section_entries_profileId_sectionKey_entryOrder_idx"
ON "profile_section_entries"("profileId", "sectionKey", "entryOrder");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profile_section_entries_profileId_fkey'
    ) THEN
        ALTER TABLE "profile_section_entries"
        ADD CONSTRAINT "profile_section_entries_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profile_section_entries_sectionId_fkey'
    ) THEN
        ALTER TABLE "profile_section_entries"
        ADD CONSTRAINT "profile_section_entries_sectionId_fkey"
        FOREIGN KEY ("sectionId") REFERENCES "profile_sections"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cv_documents" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Academic CV',
    "templateKey" TEXT NOT NULL DEFAULT 'classic',
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "previewHtml" TEXT NOT NULL DEFAULT '',
    "lastCompiledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cv_documents_profileId_idx"
ON "cv_documents"("profileId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cv_documents_profileId_fkey'
    ) THEN
        ALTER TABLE "cv_documents"
        ADD CONSTRAINT "cv_documents_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cv_render_jobs" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "message" TEXT NOT NULL DEFAULT '',
    "previewHtml" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_render_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cv_render_jobs_profileId_createdAt_idx"
ON "cv_render_jobs"("profileId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cv_render_jobs_profileId_fkey'
    ) THEN
        ALTER TABLE "cv_render_jobs"
        ADD CONSTRAINT "cv_render_jobs_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cv_render_jobs_documentId_fkey'
    ) THEN
        ALTER TABLE "cv_render_jobs"
        ADD CONSTRAINT "cv_render_jobs_documentId_fkey"
        FOREIGN KEY ("documentId") REFERENCES "cv_documents"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
