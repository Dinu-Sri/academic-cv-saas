-- Public CV share links with view tracking (legacy /s/{slug} parity).
CREATE TABLE IF NOT EXISTS "cv_shares" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareSlug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cv_shares_shareSlug_key" ON "cv_shares"("shareSlug");
CREATE UNIQUE INDEX IF NOT EXISTS "cv_shares_documentId_key" ON "cv_shares"("documentId");
CREATE INDEX IF NOT EXISTS "cv_shares_profileId_idx" ON "cv_shares"("profileId");
CREATE INDEX IF NOT EXISTS "cv_shares_workspaceId_idx" ON "cv_shares"("workspaceId");
CREATE INDEX IF NOT EXISTS "cv_shares_userId_idx" ON "cv_shares"("userId");

DO $$ BEGIN
  ALTER TABLE "cv_shares" ADD CONSTRAINT "cv_shares_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cv_shares" ADD CONSTRAINT "cv_shares_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cv_shares" ADD CONSTRAINT "cv_shares_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "cv_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
