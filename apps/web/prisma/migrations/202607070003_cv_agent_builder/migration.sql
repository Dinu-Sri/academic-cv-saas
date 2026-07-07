CREATE TABLE IF NOT EXISTS "cv_agent_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Build with AI',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_agent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cv_agent_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentsJson" JSONB NOT NULL DEFAULT '[]',
    "patchSummaryJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cv_agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cv_agent_memories" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL DEFAULT '{}',
    "confirmedFacts" JSONB NOT NULL DEFAULT '[]',
    "uncertainFacts" JSONB NOT NULL DEFAULT '[]',
    "pendingQuestions" JSONB NOT NULL DEFAULT '[]',
    "completedSections" JSONB NOT NULL DEFAULT '[]',
    "nextBestSection" TEXT NOT NULL DEFAULT 'personal',
    "preferredTone" TEXT NOT NULL DEFAULT 'professional',
    "targetCvType" TEXT NOT NULL DEFAULT 'academic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_agent_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cv_agent_attachments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileAssetId" TEXT,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'stored',
    "extractedText" TEXT NOT NULL DEFAULT '',
    "extractedFactsJson" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_agent_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cv_agent_patch_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "patchType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "patchJson" JSONB NOT NULL DEFAULT '{}',
    "resultJson" JSONB NOT NULL DEFAULT '{}',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "cv_agent_patch_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cv_agent_sessions_workspaceId_status_updatedAt_idx" ON "cv_agent_sessions"("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "cv_agent_sessions_profileId_updatedAt_idx" ON "cv_agent_sessions"("profileId", "updatedAt");
CREATE INDEX IF NOT EXISTS "cv_agent_messages_sessionId_createdAt_idx" ON "cv_agent_messages"("sessionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "cv_agent_memories_profileId_key" ON "cv_agent_memories"("profileId");
CREATE INDEX IF NOT EXISTS "cv_agent_attachments_workspaceId_createdAt_idx" ON "cv_agent_attachments"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_attachments_profileId_createdAt_idx" ON "cv_agent_attachments"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_attachments_sessionId_createdAt_idx" ON "cv_agent_attachments"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_attachments_fileAssetId_idx" ON "cv_agent_attachments"("fileAssetId");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_workspaceId_createdAt_idx" ON "cv_agent_patch_logs"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_profileId_createdAt_idx" ON "cv_agent_patch_logs"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_sessionId_createdAt_idx" ON "cv_agent_patch_logs"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_messageId_idx" ON "cv_agent_patch_logs"("messageId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_sessions_workspaceId_fkey') THEN
        ALTER TABLE "cv_agent_sessions" ADD CONSTRAINT "cv_agent_sessions_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_sessions_profileId_fkey') THEN
        ALTER TABLE "cv_agent_sessions" ADD CONSTRAINT "cv_agent_sessions_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_messages_sessionId_fkey') THEN
        ALTER TABLE "cv_agent_messages" ADD CONSTRAINT "cv_agent_messages_sessionId_fkey"
            FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_memories_profileId_fkey') THEN
        ALTER TABLE "cv_agent_memories" ADD CONSTRAINT "cv_agent_memories_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_attachments_workspaceId_fkey') THEN
        ALTER TABLE "cv_agent_attachments" ADD CONSTRAINT "cv_agent_attachments_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_attachments_profileId_fkey') THEN
        ALTER TABLE "cv_agent_attachments" ADD CONSTRAINT "cv_agent_attachments_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_attachments_sessionId_fkey') THEN
        ALTER TABLE "cv_agent_attachments" ADD CONSTRAINT "cv_agent_attachments_sessionId_fkey"
            FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_attachments_fileAssetId_fkey') THEN
        ALTER TABLE "cv_agent_attachments" ADD CONSTRAINT "cv_agent_attachments_fileAssetId_fkey"
            FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_workspaceId_fkey') THEN
        ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_profileId_fkey') THEN
        ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_sessionId_fkey') THEN
        ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_sessionId_fkey"
            FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_messageId_fkey') THEN
        ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_messageId_fkey"
            FOREIGN KEY ("messageId") REFERENCES "cv_agent_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
