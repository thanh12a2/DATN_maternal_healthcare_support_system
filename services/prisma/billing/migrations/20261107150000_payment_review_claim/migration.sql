ALTER TABLE "payments" ADD COLUMN "claimed_by_account_id" UUID,
  ADD COLUMN "claim_expires_at" TIMESTAMPTZ(6);

CREATE INDEX "payments_review_queue_idx" ON "payments" ("status", "method", "created_at");
