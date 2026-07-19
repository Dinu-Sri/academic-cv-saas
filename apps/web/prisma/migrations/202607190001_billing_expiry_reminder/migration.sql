-- Billing: track previous plan + expiry reminder for emails / UX

ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "previousPlanKey" TEXT;
ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "expiryReminderSentAt" TIMESTAMP(3);
