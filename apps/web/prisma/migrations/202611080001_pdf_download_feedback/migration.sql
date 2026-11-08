-- One-time peer review required before a logged-in user's first PDF download.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pdfDownloadFeedbackAt" TIMESTAMP(3);
