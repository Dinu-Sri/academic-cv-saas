-- Invoice / billing contact fields for PayHere checkouts and future invoice PDFs.
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "invoiceName" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "invoiceEmail" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "invoicePhone" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "invoiceAddress" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "invoiceCity" TEXT;
ALTER TABLE "billing_payments" ADD COLUMN IF NOT EXISTS "invoiceCountry" TEXT;
