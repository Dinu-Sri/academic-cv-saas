CREATE TABLE "profile_sections" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profile_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_sections_profileId_key_key" ON "profile_sections"("profileId", "key");

ALTER TABLE "profile_sections" ADD CONSTRAINT "profile_sections_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
