ALTER TABLE "academic_profiles"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "profile_section_entries"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedBy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "archiveSource" TEXT NOT NULL DEFAULT '';

ALTER TABLE "cv_documents"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "cv_agent_messages"
  ADD COLUMN IF NOT EXISTS "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "compactedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "summaryBoundary" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "agent_proposals" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "messageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "title" TEXT NOT NULL DEFAULT 'CV update',
  "summary" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'cv_agent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "staleAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "agent_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_proposal_changes" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "changeOrder" INTEGER NOT NULL DEFAULT 0,
  "patchType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL DEFAULT '',
  "targetField" TEXT NOT NULL DEFAULT '',
  "sectionKey" TEXT NOT NULL DEFAULT '',
  "expectedVersion" INTEGER,
  "beforeHash" TEXT NOT NULL DEFAULT '',
  "beforeValueJson" JSONB NOT NULL DEFAULT '{}',
  "afterValueJson" JSONB NOT NULL DEFAULT '{}',
  "patchJson" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_proposal_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_approvals" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "decidedBy" TEXT NOT NULL DEFAULT '',
  "reason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "profile_revisions" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "proposalId" TEXT,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL DEFAULT '',
  "action" TEXT NOT NULL,
  "beforeJson" JSONB NOT NULL DEFAULT '{}',
  "afterJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_revisions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cv_agent_patch_logs"
  ADD COLUMN IF NOT EXISTS "proposalId" TEXT,
  ADD COLUMN IF NOT EXISTS "proposalChangeId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS "agent_proposals_idempotencyKey_key" ON "agent_proposals"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "agent_proposals_workspaceId_status_createdAt_idx" ON "agent_proposals"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_proposals_profileId_status_createdAt_idx" ON "agent_proposals"("profileId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_proposals_sessionId_status_createdAt_idx" ON "agent_proposals"("sessionId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_proposal_changes_proposalId_status_idx" ON "agent_proposal_changes"("proposalId", "status");
CREATE INDEX IF NOT EXISTS "agent_proposal_changes_targetType_targetId_idx" ON "agent_proposal_changes"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "agent_approvals_workspaceId_createdAt_idx" ON "agent_approvals"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_approvals_profileId_createdAt_idx" ON "agent_approvals"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_approvals_proposalId_idx" ON "agent_approvals"("proposalId");
CREATE INDEX IF NOT EXISTS "profile_revisions_workspaceId_createdAt_idx" ON "profile_revisions"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "profile_revisions_profileId_createdAt_idx" ON "profile_revisions"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "profile_revisions_proposalId_idx" ON "profile_revisions"("proposalId");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_proposalId_idx" ON "cv_agent_patch_logs"("proposalId");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_proposalChangeId_idx" ON "cv_agent_patch_logs"("proposalChangeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposals_workspaceId_fkey') THEN
    ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposals_profileId_fkey') THEN
    ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposals_sessionId_fkey') THEN
    ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposals_messageId_fkey') THEN
    ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "cv_agent_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposal_changes_proposalId_fkey') THEN
    ALTER TABLE "agent_proposal_changes" ADD CONSTRAINT "agent_proposal_changes_proposalId_fkey"
      FOREIGN KEY ("proposalId") REFERENCES "agent_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_approvals_workspaceId_fkey') THEN
    ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_approvals_profileId_fkey') THEN
    ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_approvals_sessionId_fkey') THEN
    ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_approvals_proposalId_fkey') THEN
    ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_proposalId_fkey"
      FOREIGN KEY ("proposalId") REFERENCES "agent_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profile_revisions_workspaceId_fkey') THEN
    ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profile_revisions_profileId_fkey') THEN
    ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profile_revisions_proposalId_fkey') THEN
    ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_proposalId_fkey"
      FOREIGN KEY ("proposalId") REFERENCES "agent_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_proposalId_fkey') THEN
    ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_proposalId_fkey"
      FOREIGN KEY ("proposalId") REFERENCES "agent_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_proposalChangeId_fkey') THEN
    ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_proposalChangeId_fkey"
      FOREIGN KEY ("proposalChangeId") REFERENCES "agent_proposal_changes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
