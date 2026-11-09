ALTER TABLE "stage_tickets" ADD COLUMN "assistance_claimed_by" UUID,
  ADD COLUMN "assistance_claim_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "assistance_handled_at" TIMESTAMPTZ(6);
CREATE INDEX "stage_tickets_overdue_lookup_idx" ON "stage_tickets" ("state", "call_expires_at");
