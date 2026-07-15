CREATE TABLE IF NOT EXISTS "agent_memory_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "taskId" TEXT,
  "threadId" TEXT,
  "candidateId" TEXT NOT NULL DEFAULT '',
  "scope" TEXT NOT NULL DEFAULT 'profile',
  "category" TEXT NOT NULL DEFAULT 'stable_preference',
  "status" TEXT NOT NULL DEFAULT 'active',
  "content" TEXT NOT NULL,
  "rationale" TEXT NOT NULL DEFAULT '',
  "retrievalText" TEXT NOT NULL DEFAULT '',
  "evidenceJson" JSONB NOT NULL DEFAULT '{}',
  "sensitivity" TEXT NOT NULL DEFAULT 'normal',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "supersededById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "agent_memory_candidates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "taskId" TEXT,
  "threadId" TEXT,
  "runId" TEXT NOT NULL DEFAULT '',
  "messageId" TEXT NOT NULL DEFAULT '',
  "promotedMemoryId" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'task_specific',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "content" TEXT NOT NULL,
  "rationale" TEXT NOT NULL DEFAULT '',
  "evidenceJson" JSONB NOT NULL DEFAULT '{}',
  "sensitivity" TEXT NOT NULL DEFAULT 'normal',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "knowledge_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT,
  "namespace" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'system',
  "sourceType" TEXT NOT NULL DEFAULT 'curated',
  "title" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "status" TEXT NOT NULL DEFAULT 'active',
  "sourceUri" TEXT NOT NULL DEFAULT '',
  "checksum" TEXT NOT NULL DEFAULT '',
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "namespace" TEXT NOT NULL,
  "chunkOrder" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL,
  "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "embeddingJson" JSONB NOT NULL DEFAULT '[]',
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "agent_memory_items_workspaceId_status_updatedAt_idx" ON "agent_memory_items"("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_memory_items_profileId_status_updatedAt_idx" ON "agent_memory_items"("profileId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_memory_items_taskId_status_updatedAt_idx" ON "agent_memory_items"("taskId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_memory_items_threadId_status_updatedAt_idx" ON "agent_memory_items"("threadId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "agent_memory_items_category_status_idx" ON "agent_memory_items"("category", "status");

CREATE INDEX IF NOT EXISTS "agent_memory_candidates_workspaceId_status_createdAt_idx" ON "agent_memory_candidates"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_memory_candidates_profileId_status_createdAt_idx" ON "agent_memory_candidates"("profileId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_memory_candidates_taskId_status_createdAt_idx" ON "agent_memory_candidates"("taskId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_memory_candidates_threadId_status_createdAt_idx" ON "agent_memory_candidates"("threadId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_memory_candidates_category_status_idx" ON "agent_memory_candidates"("category", "status");

CREATE INDEX IF NOT EXISTS "knowledge_documents_workspaceId_namespace_status_idx" ON "knowledge_documents"("workspaceId", "namespace", "status");
CREATE INDEX IF NOT EXISTS "knowledge_documents_namespace_visibility_status_idx" ON "knowledge_documents"("namespace", "visibility", "status");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_workspaceId_namespace_createdAt_idx" ON "knowledge_chunks"("workspaceId", "namespace", "createdAt");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_documentId_chunkOrder_idx" ON "knowledge_chunks"("documentId", "chunkOrder");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_items_workspaceId_fkey') THEN
    ALTER TABLE "agent_memory_items" ADD CONSTRAINT "agent_memory_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_items_profileId_fkey') THEN
    ALTER TABLE "agent_memory_items" ADD CONSTRAINT "agent_memory_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_items_taskId_fkey') THEN
    ALTER TABLE "agent_memory_items" ADD CONSTRAINT "agent_memory_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_items_threadId_fkey') THEN
    ALTER TABLE "agent_memory_items" ADD CONSTRAINT "agent_memory_items_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_candidates_workspaceId_fkey') THEN
    ALTER TABLE "agent_memory_candidates" ADD CONSTRAINT "agent_memory_candidates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_candidates_profileId_fkey') THEN
    ALTER TABLE "agent_memory_candidates" ADD CONSTRAINT "agent_memory_candidates_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_candidates_taskId_fkey') THEN
    ALTER TABLE "agent_memory_candidates" ADD CONSTRAINT "agent_memory_candidates_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memory_candidates_threadId_fkey') THEN
    ALTER TABLE "agent_memory_candidates" ADD CONSTRAINT "agent_memory_candidates_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_documents_workspaceId_fkey') THEN
    ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_documentId_fkey') THEN
    ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_workspaceId_fkey') THEN
    ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "knowledge_documents" ("id", "workspaceId", "namespace", "visibility", "sourceType", "title", "version", "status", "sourceUri", "checksum", "metadataJson")
VALUES
  ('knowledge_academic_cv_guidance_v1', NULL, 'academic_cv_guidance', 'system', 'curated', 'Academic CV Review Guidance', '1.0.0', 'active', 'cvscholar://guidance/academic-cv-review', 'phase4-academic-cv-guidance-v1', '{"seededBy":"202607150002_agent_phase4_memory_knowledge"}'),
  ('knowledge_cvscholar_product_v1', NULL, 'cvscholar_product', 'system', 'curated', 'CVScholar Agent Product Rules', '1.0.0', 'active', 'cvscholar://guidance/product-agent-rules', 'phase4-product-rules-v1', '{"seededBy":"202607150002_agent_phase4_memory_knowledge"}')
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "version" = EXCLUDED."version",
  "status" = EXCLUDED."status",
  "metadataJson" = EXCLUDED."metadataJson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "knowledge_chunks" ("id", "documentId", "workspaceId", "namespace", "chunkOrder", "title", "content", "tokenEstimate", "metadataJson")
VALUES
  ('knowledge_academic_cv_guidance_v1_chunk_1', 'knowledge_academic_cv_guidance_v1', NULL, 'academic_cv_guidance', 1, 'Academic CV review rubric', 'Review academic CVs for completeness, credibility, section coverage, evidence strength, recency, and audience fit. Distinguish verified profile facts from suggestions. Never invent achievements, publications, grants, metrics, or dates. A useful review should identify strengths, gaps, and next actions grounded in existing profile or CV document data.', 64, '{"kind":"rubric"}'),
  ('knowledge_academic_cv_guidance_v1_chunk_2', 'knowledge_academic_cv_guidance_v1', NULL, 'academic_cv_guidance', 2, 'Common missing academic CV evidence', 'Common CV gaps include weak research summary, missing publication metadata, incomplete teaching details, absent grants or awards, missing service evidence, unclear appointment dates, and sparse links such as ORCID, Google Scholar, personal website, or institutional profile. Recommendations should be phrased as suggestions unless supported by stored data.', 58, '{"kind":"gap_check"}'),
  ('knowledge_cvscholar_product_v1_chunk_1', 'knowledge_cvscholar_product_v1', NULL, 'cvscholar_product', 1, 'CVScholar authority rules', 'The database profile is the source of truth. Agent memories and knowledge chunks are advisory context only. Writes require typed proposals, validation, approval, and audit. Private workspace knowledge must never be retrieved across workspace boundaries.', 43, '{"kind":"policy"}')
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "tokenEstimate" = EXCLUDED."tokenEstimate",
  "metadataJson" = EXCLUDED."metadataJson";
