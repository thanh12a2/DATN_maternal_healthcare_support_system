ALTER TABLE "doctors" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
CREATE INDEX "doctors_deleted_at_status_idx" ON "doctors"("deleted_at", "status");
