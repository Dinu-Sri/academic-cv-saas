-- Guest trial sessions (try product before login)

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "guest_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compileCount" INTEGER NOT NULL DEFAULT 0,
    "chatCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "guest_sessions_token_key" ON "guest_sessions"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "guest_sessions_userId_key" ON "guest_sessions"("userId");
CREATE INDEX IF NOT EXISTS "guest_sessions_expiresAt_idx" ON "guest_sessions"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_sessions_userId_fkey'
  ) THEN
    ALTER TABLE "guest_sessions"
      ADD CONSTRAINT "guest_sessions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
