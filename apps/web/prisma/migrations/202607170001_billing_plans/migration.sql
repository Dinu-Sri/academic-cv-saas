-- Billing: workspace subscription + payment records for Free / PDF Pass / Scholar Annual

CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sourcePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_subscriptions_workspaceId_key" ON "workspace_subscriptions"("workspaceId");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_planKey_status_idx" ON "workspace_subscriptions"("planKey", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_subscriptions_workspaceId_fkey'
  ) THEN
    ALTER TABLE "workspace_subscriptions"
      ADD CONSTRAINT "workspace_subscriptions_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "billing_payments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "billingDays" INTEGER NOT NULL DEFAULT 0,
    "payherePaymentId" TEXT,
    "gatewayResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_payments_orderId_key" ON "billing_payments"("orderId");
CREATE INDEX IF NOT EXISTS "billing_payments_workspaceId_createdAt_idx" ON "billing_payments"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "billing_payments_userId_createdAt_idx" ON "billing_payments"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "billing_payments_status_idx" ON "billing_payments"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_payments_workspaceId_fkey'
  ) THEN
    ALTER TABLE "billing_payments"
      ADD CONSTRAINT "billing_payments_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
