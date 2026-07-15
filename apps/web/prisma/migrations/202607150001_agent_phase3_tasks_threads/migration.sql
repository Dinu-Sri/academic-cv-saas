ALTER TABLE "cv_agent_sessions" ADD COLUMN IF NOT EXISTS "activeTaskId" TEXT;
ALTER TABLE "cv_agent_sessions" ADD COLUMN IF NOT EXISTS "activeThreadId" TEXT;

ALTER TABLE "cv_agent_messages" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "cv_agent_messages" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

ALTER TABLE "cv_agent_attachments" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "cv_agent_attachments" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

ALTER TABLE "cv_agent_patch_logs" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "cv_agent_patch_logs" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

ALTER TABLE "agent_proposals" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "agent_proposals" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

ALTER TABLE "agent_approvals" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "agent_approvals" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "threadId" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "currentNode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "resumeStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "resumePayloadJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMP(3);
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "agent_tasks" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "activeDocumentId" TEXT,
  "activeThreadId" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL DEFAULT 'Build my academic CV',
  "goal" TEXT NOT NULL DEFAULT '',
  "targetOpportunity" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "pendingQuestionsJson" JSONB NOT NULL DEFAULT '[]',
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_threads" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "chapterNumber" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL DEFAULT 'Chapter 1',
  "status" TEXT NOT NULL DEFAULT 'active',
  "compactionCount" INTEGER NOT NULL DEFAULT 0,
  "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "rolloverReason" TEXT NOT NULL DEFAULT '',
  "stateJson" JSONB NOT NULL DEFAULT '{}',
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_thread_summaries" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "summaryVersion" INTEGER NOT NULL DEFAULT 1,
  "coveredMessageStartId" TEXT NOT NULL DEFAULT '',
  "coveredMessageEndId" TEXT NOT NULL DEFAULT '',
  "coveredMessageCount" INTEGER NOT NULL DEFAULT 0,
  "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "summaryJson" JSONB NOT NULL DEFAULT '{}',
  "decisionsJson" JSONB NOT NULL DEFAULT '[]',
  "pendingQuestionsJson" JSONB NOT NULL DEFAULT '[]',
  "proposalIdsJson" JSONB NOT NULL DEFAULT '[]',
  "entityRefsJson" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_thread_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_graph_checkpoints" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "taskId" TEXT,
  "threadId" TEXT,
  "checkpointKey" TEXT NOT NULL,
  "nodeName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "stateJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_graph_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cv_agent_sessions_activeTaskId_idx" ON "cv_agent_sessions"("activeTaskId");
CREATE INDEX IF NOT EXISTS "cv_agent_sessions_activeThreadId_idx" ON "cv_agent_sessions"("activeThreadId");
CREATE INDEX IF NOT EXISTS "cv_agent_messages_taskId_createdAt_idx" ON "cv_agent_messages"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_messages_threadId_createdAt_idx" ON "cv_agent_messages"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_attachments_taskId_createdAt_idx" ON "cv_agent_attachments"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_attachments_threadId_createdAt_idx" ON "cv_agent_attachments"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_taskId_createdAt_idx" ON "cv_agent_patch_logs"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "cv_agent_patch_logs_threadId_createdAt_idx" ON "cv_agent_patch_logs"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_proposals_taskId_status_createdAt_idx" ON "agent_proposals"("taskId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_proposals_threadId_status_createdAt_idx" ON "agent_proposals"("threadId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_approvals_taskId_createdAt_idx" ON "agent_approvals"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_approvals_threadId_createdAt_idx" ON "agent_approvals"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_runs_taskId_createdAt_idx" ON "agent_runs"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_runs_threadId_createdAt_idx" ON "agent_runs"("threadId", "createdAt");

CREATE INDEX IF NOT EXISTS "agent_tasks_workspaceId_status_updatedAt_idx" ON "agent_tasks"("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_tasks_profileId_status_updatedAt_idx" ON "agent_tasks"("profileId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_tasks_sessionId_status_updatedAt_idx" ON "agent_tasks"("sessionId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_tasks_activeDocumentId_idx" ON "agent_tasks"("activeDocumentId");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_threads_taskId_chapterNumber_key" ON "agent_threads"("taskId", "chapterNumber");
CREATE INDEX IF NOT EXISTS "agent_threads_workspaceId_status_updatedAt_idx" ON "agent_threads"("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_threads_profileId_status_updatedAt_idx" ON "agent_threads"("profileId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_threads_sessionId_status_updatedAt_idx" ON "agent_threads"("sessionId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_thread_summaries_workspaceId_createdAt_idx" ON "agent_thread_summaries"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_thread_summaries_profileId_createdAt_idx" ON "agent_thread_summaries"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_thread_summaries_taskId_createdAt_idx" ON "agent_thread_summaries"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_thread_summaries_threadId_createdAt_idx" ON "agent_thread_summaries"("threadId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_graph_checkpoints_checkpointKey_key" ON "agent_graph_checkpoints"("checkpointKey");
CREATE INDEX IF NOT EXISTS "agent_graph_checkpoints_workspaceId_createdAt_idx" ON "agent_graph_checkpoints"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_graph_checkpoints_profileId_createdAt_idx" ON "agent_graph_checkpoints"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_graph_checkpoints_runId_createdAt_idx" ON "agent_graph_checkpoints"("runId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_graph_checkpoints_taskId_createdAt_idx" ON "agent_graph_checkpoints"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_graph_checkpoints_threadId_createdAt_idx" ON "agent_graph_checkpoints"("threadId", "createdAt");

INSERT INTO "agent_tasks" (
  "id",
  "workspaceId",
  "profileId",
  "sessionId",
  "activeThreadId",
  "title",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'task_' || md5(s."id"),
  s."workspaceId",
  s."profileId",
  s."id",
  'thread_' || md5(s."id"),
  COALESCE(NULLIF(s."title", ''), 'Build my academic CV'),
  CASE WHEN s."status" = 'archived' THEN 'closed' ELSE 'active' END,
  s."createdAt",
  s."updatedAt"
FROM "cv_agent_sessions" s
WHERE NOT EXISTS (
  SELECT 1 FROM "agent_tasks" t WHERE t."id" = 'task_' || md5(s."id")
);

INSERT INTO "agent_threads" (
  "id",
  "workspaceId",
  "profileId",
  "sessionId",
  "taskId",
  "chapterNumber",
  "title",
  "status",
  "lastMessageAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'thread_' || md5(s."id"),
  s."workspaceId",
  s."profileId",
  s."id",
  'task_' || md5(s."id"),
  1,
  'Chapter 1',
  CASE WHEN s."status" = 'archived' THEN 'closed' ELSE 'active' END,
  s."lastMessageAt",
  s."createdAt",
  s."updatedAt"
FROM "cv_agent_sessions" s
WHERE NOT EXISTS (
  SELECT 1 FROM "agent_threads" th WHERE th."id" = 'thread_' || md5(s."id")
);

UPDATE "cv_agent_sessions" s
SET
  "activeTaskId" = COALESCE(s."activeTaskId", 'task_' || md5(s."id")),
  "activeThreadId" = COALESCE(s."activeThreadId", 'thread_' || md5(s."id"));

UPDATE "cv_agent_messages" m
SET
  "taskId" = COALESCE(m."taskId", s."activeTaskId"),
  "threadId" = COALESCE(m."threadId", s."activeThreadId")
FROM "cv_agent_sessions" s
WHERE m."sessionId" = s."id";

UPDATE "cv_agent_attachments" a
SET
  "taskId" = COALESCE(a."taskId", s."activeTaskId"),
  "threadId" = COALESCE(a."threadId", s."activeThreadId")
FROM "cv_agent_sessions" s
WHERE a."sessionId" = s."id";

UPDATE "cv_agent_patch_logs" p
SET
  "taskId" = COALESCE(p."taskId", s."activeTaskId"),
  "threadId" = COALESCE(p."threadId", s."activeThreadId")
FROM "cv_agent_sessions" s
WHERE p."sessionId" = s."id";

UPDATE "agent_proposals" p
SET
  "taskId" = COALESCE(p."taskId", s."activeTaskId"),
  "threadId" = COALESCE(p."threadId", s."activeThreadId")
FROM "cv_agent_sessions" s
WHERE p."sessionId" = s."id";

UPDATE "agent_approvals" a
SET
  "taskId" = COALESCE(a."taskId", s."activeTaskId"),
  "threadId" = COALESCE(a."threadId", s."activeThreadId")
FROM "cv_agent_sessions" s
WHERE a."sessionId" = s."id";

UPDATE "agent_runs" r
SET
  "taskId" = COALESCE(r."taskId", s."activeTaskId"),
  "threadId" = COALESCE(r."threadId", s."activeThreadId")
FROM "cv_agent_sessions" s
WHERE r."sessionId" = s."id";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_workspaceId_fkey') THEN
    ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_profileId_fkey') THEN
    ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_sessionId_fkey') THEN
    ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_activeDocumentId_fkey') THEN
    ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_activeDocumentId_fkey"
      FOREIGN KEY ("activeDocumentId") REFERENCES "cv_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_threads_workspaceId_fkey') THEN
    ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_threads_profileId_fkey') THEN
    ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_threads_sessionId_fkey') THEN
    ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_threads_taskId_fkey') THEN
    ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_thread_summaries_workspaceId_fkey') THEN
    ALTER TABLE "agent_thread_summaries" ADD CONSTRAINT "agent_thread_summaries_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_thread_summaries_profileId_fkey') THEN
    ALTER TABLE "agent_thread_summaries" ADD CONSTRAINT "agent_thread_summaries_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_thread_summaries_taskId_fkey') THEN
    ALTER TABLE "agent_thread_summaries" ADD CONSTRAINT "agent_thread_summaries_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_thread_summaries_threadId_fkey') THEN
    ALTER TABLE "agent_thread_summaries" ADD CONSTRAINT "agent_thread_summaries_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_graph_checkpoints_workspaceId_fkey') THEN
    ALTER TABLE "agent_graph_checkpoints" ADD CONSTRAINT "agent_graph_checkpoints_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_graph_checkpoints_profileId_fkey') THEN
    ALTER TABLE "agent_graph_checkpoints" ADD CONSTRAINT "agent_graph_checkpoints_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_graph_checkpoints_runId_fkey') THEN
    ALTER TABLE "agent_graph_checkpoints" ADD CONSTRAINT "agent_graph_checkpoints_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_graph_checkpoints_taskId_fkey') THEN
    ALTER TABLE "agent_graph_checkpoints" ADD CONSTRAINT "agent_graph_checkpoints_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_graph_checkpoints_threadId_fkey') THEN
    ALTER TABLE "agent_graph_checkpoints" ADD CONSTRAINT "agent_graph_checkpoints_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_messages_taskId_fkey') THEN
    ALTER TABLE "cv_agent_messages" ADD CONSTRAINT "cv_agent_messages_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_messages_threadId_fkey') THEN
    ALTER TABLE "cv_agent_messages" ADD CONSTRAINT "cv_agent_messages_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_attachments_taskId_fkey') THEN
    ALTER TABLE "cv_agent_attachments" ADD CONSTRAINT "cv_agent_attachments_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_attachments_threadId_fkey') THEN
    ALTER TABLE "cv_agent_attachments" ADD CONSTRAINT "cv_agent_attachments_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_taskId_fkey') THEN
    ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cv_agent_patch_logs_threadId_fkey') THEN
    ALTER TABLE "cv_agent_patch_logs" ADD CONSTRAINT "cv_agent_patch_logs_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposals_taskId_fkey') THEN
    ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_proposals_threadId_fkey') THEN
    ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_approvals_taskId_fkey') THEN
    ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_approvals_threadId_fkey') THEN
    ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_taskId_fkey') THEN
    ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_threadId_fkey') THEN
    ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
