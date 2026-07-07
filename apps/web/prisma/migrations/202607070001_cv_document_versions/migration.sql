ALTER TABLE "cv_documents"
ADD COLUMN IF NOT EXISTS "visibleSectionKeys" JSONB NOT NULL DEFAULT '[]';
