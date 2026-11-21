ALTER TABLE "appointments" ADD COLUMN "reassignment_claimed_by" UUID,
  ADD COLUMN "reassignment_claim_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "reassignment_reason" VARCHAR(500);
