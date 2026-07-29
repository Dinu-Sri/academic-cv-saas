-- Retain unique user-supplied academic fields for future taxonomy review.

CREATE TABLE IF NOT EXISTS "academic_field_suggestions" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "academicFieldGroup" TEXT NOT NULL,
    "academicField" TEXT NOT NULL,
    "academicFieldKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_field_suggestions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "academic_field_suggestions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_field_suggestions_profileId_academicFieldKey_key"
  ON "academic_field_suggestions"("profileId", "academicFieldKey");
CREATE INDEX IF NOT EXISTS "academic_field_suggestions_academicFieldGroup_academicFieldKey_idx"
  ON "academic_field_suggestions"("academicFieldGroup", "academicFieldKey");
