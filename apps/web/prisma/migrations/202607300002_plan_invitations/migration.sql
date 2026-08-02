-- Admin package invitations (email-bound, single-use, expiring).
CREATE TABLE IF NOT EXISTS "plan_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "billingDays" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdByAdminEmail" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_invitations_token_key" ON "plan_invitations"("token");
CREATE INDEX IF NOT EXISTS "plan_invitations_email_createdAt_idx" ON "plan_invitations"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "plan_invitations_expiresAt_idx" ON "plan_invitations"("expiresAt");
