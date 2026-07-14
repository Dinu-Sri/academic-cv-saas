CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "messageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "mode" TEXT NOT NULL DEFAULT 'transitional',
  "intent" TEXT NOT NULL DEFAULT 'general',
  "provider" TEXT NOT NULL DEFAULT '',
  "model" TEXT NOT NULL DEFAULT '',
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "promptVersion" TEXT NOT NULL DEFAULT 'cv-agent-v1',
  "toolVersion" TEXT NOT NULL DEFAULT 'phase2-v1',
  "error" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_events" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL DEFAULT '',
  "payloadJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_tool_calls" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "toolVersion" TEXT NOT NULL DEFAULT 'phase2-v1',
  "risk" TEXT NOT NULL DEFAULT 'read',
  "status" TEXT NOT NULL DEFAULT 'started',
  "inputJson" JSONB NOT NULL DEFAULT '{}',
  "outputJson" JSONB NOT NULL DEFAULT '{}',
  "error" TEXT NOT NULL DEFAULT '',
  "idempotencyKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_runs_workspaceId_status_createdAt_idx" ON "agent_runs"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_runs_profileId_status_createdAt_idx" ON "agent_runs"("profileId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_runs_sessionId_createdAt_idx" ON "agent_runs"("sessionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_events_runId_sequence_key" ON "agent_events"("runId", "sequence");
CREATE INDEX IF NOT EXISTS "agent_events_workspaceId_createdAt_idx" ON "agent_events"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_events_profileId_createdAt_idx" ON "agent_events"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_events_runId_createdAt_idx" ON "agent_events"("runId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_tool_calls_idempotencyKey_key" ON "agent_tool_calls"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "agent_tool_calls_workspaceId_startedAt_idx" ON "agent_tool_calls"("workspaceId", "startedAt");
CREATE INDEX IF NOT EXISTS "agent_tool_calls_profileId_startedAt_idx" ON "agent_tool_calls"("profileId", "startedAt");
CREATE INDEX IF NOT EXISTS "agent_tool_calls_runId_startedAt_idx" ON "agent_tool_calls"("runId", "startedAt");
CREATE INDEX IF NOT EXISTS "agent_tool_calls_toolName_status_idx" ON "agent_tool_calls"("toolName", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_workspaceId_fkey') THEN
    ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_profileId_fkey') THEN
    ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_sessionId_fkey') THEN
    ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "cv_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_messageId_fkey') THEN
    ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "cv_agent_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_events_workspaceId_fkey') THEN
    ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_events_profileId_fkey') THEN
    ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_events_runId_fkey') THEN
    ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tool_calls_workspaceId_fkey') THEN
    ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tool_calls_profileId_fkey') THEN
    ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tool_calls_runId_fkey') THEN
    ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
