-- CreateEnum
CREATE TYPE "public"."EscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."consultation_escalations" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "reason_code" VARCHAR(50) NOT NULL,
    "detail" VARCHAR(500),
    "status" "public"."EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "raised_by_account_id" UUID NOT NULL,
    "raised_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_by_account_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_by_account_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution_note" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consultation_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_escalations_thread_id_raised_at_idx" ON "public"."consultation_escalations"("thread_id", "raised_at");

-- CreateIndex
CREATE INDEX "consultation_escalations_status_raised_at_idx" ON "public"."consultation_escalations"("status", "raised_at");

-- AddForeignKey
ALTER TABLE "public"."consultation_escalations" ADD CONSTRAINT "consultation_escalations_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."consultation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
