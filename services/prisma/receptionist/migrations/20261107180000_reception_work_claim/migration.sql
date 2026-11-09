ALTER TABLE "reception_cases" ADD COLUMN "work_claimed_by" UUID,
  ADD COLUMN "work_claim_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "work_running_token" UUID,
  ADD COLUMN "work_running_at" TIMESTAMPTZ(6);
