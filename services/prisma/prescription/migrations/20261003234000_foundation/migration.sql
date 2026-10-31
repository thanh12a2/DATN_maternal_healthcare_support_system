-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."PrescriptionStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."prescriptions" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "pregnancy_episode_id" UUID,
    "prescribing_doctor_id" UUID NOT NULL,
    "status" "public"."PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "supersedes_prescription_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "issued_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "medication_code" VARCHAR(100),
    "medication_name" VARCHAR(200) NOT NULL,
    "strength" VARCHAR(100),
    "dosage_form" VARCHAR(100),
    "route" VARCHAR(80) NOT NULL,
    "dose" VARCHAR(80) NOT NULL,
    "frequency" VARCHAR(120) NOT NULL,
    "duration_days" INTEGER,
    "instruction" VARCHAR(1000) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prescription_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_encounter_id_status_idx" ON "public"."prescriptions"("encounter_id", "status");

-- CreateIndex
CREATE INDEX "prescriptions_patient_id_created_at_idx" ON "public"."prescriptions"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "prescription_items_prescription_id_sort_order_idx" ON "public"."prescription_items"("prescription_id", "sort_order");

-- CreateIndex
CREATE INDEX "prescription_outbox_status_occurred_at_idx" ON "public"."prescription_outbox"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
