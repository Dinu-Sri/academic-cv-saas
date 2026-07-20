-- User preferences: privacy, marketing, CV PDF defaults, appearance

CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT true,
    "marketingSms" BOOLEAN NOT NULL DEFAULT false,
    "productUpdates" BOOLEAN NOT NULL DEFAULT true,
    "cookieConsentJson" JSONB NOT NULL DEFAULT '{}',
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "cvDefaultsJson" JSONB NOT NULL DEFAULT '{}',
    "appearanceJson" JSONB NOT NULL DEFAULT '{}',
    "agentMemoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_userId_key" ON "user_preferences"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_userId_fkey'
  ) THEN
    ALTER TABLE "user_preferences"
      ADD CONSTRAINT "user_preferences_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
