-- Structured academic identity and active time-to-first-CV measurement.

ALTER TABLE "academic_profiles"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "academicFieldGroup" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "academicField" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "academicFieldKey" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "cv_time_to_first_cv" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "elapsedSeconds" INTEGER,
    "documentId" TEXT NOT NULL DEFAULT '',
    "renderJobId" TEXT NOT NULL DEFAULT '',
    "qualifyingCompleteness" INTEGER NOT NULL DEFAULT 0,
    "measurementVersion" TEXT NOT NULL DEFAULT 'active-v1',
    "startedBy" TEXT NOT NULL DEFAULT 'editor_activity',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cv_time_to_first_cv_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cv_time_to_first_cv_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cv_time_to_first_cv_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "cv_time_to_first_cv_profileId_key"
  ON "cv_time_to_first_cv"("profileId");
CREATE INDEX IF NOT EXISTS "cv_time_to_first_cv_completedAt_idx"
  ON "cv_time_to_first_cv"("completedAt");
CREATE INDEX IF NOT EXISTS "cv_time_to_first_cv_measurementVersion_completedAt_idx"
  ON "cv_time_to_first_cv"("measurementVersion", "completedAt");
