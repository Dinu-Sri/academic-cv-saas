-- Checkout discount / promo codes + payment discount snapshots.
CREATE TABLE IF NOT EXISTS "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "planKey" TEXT NOT NULL DEFAULT '',
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdByAdminEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_code_key" ON "discount_codes"("code");
CREATE INDEX IF NOT EXISTS "discount_codes_active_expiresAt_idx" ON "discount_codes"("active", "expiresAt");

ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "discountCodeId" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "discountCode" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2);
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_payments_discountCodeId_fkey'
  ) THEN
    ALTER TABLE "billing_payments"
      ADD CONSTRAINT "billing_payments_discountCodeId_fkey"
      FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "billing_payments_discountCodeId_idx" ON "billing_payments"("discountCodeId");
