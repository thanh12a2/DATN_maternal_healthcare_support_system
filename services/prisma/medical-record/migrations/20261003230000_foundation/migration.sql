-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."EncounterState" AS ENUM ('DRAFT', 'IN_PROGRESS', 'AWAITING_RESULTS', 'READY_FOR_REVIEW', 'FINALIZED');

-- CreateEnum
CREATE TYPE "public"."AssignmentRole" AS ENUM ('PRIMARY', 'CONSULTING', 'NURSE', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "public"."PregnancyEpisodeStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."PregnancyRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."ServiceOrderStatus" AS ENUM ('ORDERED', 'IN_PROGRESS', 'PERFORMED', 'RESULT_AVAILABLE', 'VERIFIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."clinical_encounters" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "pregnancy_episode_id" UUID,
    "primary_doctor_id" UUID NOT NULL,
    "state" "public"."EncounterState" NOT NULL DEFAULT 'DRAFT',
    "chief_complaint" VARCHAR(2000),
    "clinical_summary" VARCHAR(10000),
    "started_at" TIMESTAMPTZ(6),
    "review_ready_at" TIMESTAMPTZ(6),
    "finalized_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinical_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."encounter_assignments" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "role" "public"."AssignmentRole" NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "encounter_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pregnancy_episodes" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "public"."PregnancyEpisodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "estimated_due_date" DATE,
    "last_menstrual_period" DATE,
    "risk_level" "public"."PregnancyRiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pregnancy_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vital_signs" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "heart_rate" INTEGER,
    "temperature" DECIMAL(4,1),
    "weight" DECIMAL(6,2),
    "recorded_by" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clinical_notes" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "text" VARCHAR(10000) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."diagnoses" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "doctor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clinical_service_orders" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "catalog_service_id" UUID NOT NULL,
    "stage_code" VARCHAR(50) NOT NULL,
    "ordered_by_doctor_id" UUID NOT NULL,
    "required_result" BOOLEAN NOT NULL DEFAULT true,
    "billable_snapshot" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."ServiceOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "structured_result" JSONB,
    "performed_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."external_clinical_references" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_clinical_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."encounter_amendments" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "section" VARCHAR(80) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "patch" JSONB NOT NULL,
    "author_doctor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medical_idempotency" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "resource_id" UUID,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medical_audit" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "actor_id" UUID,
    "encounter_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medical_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "medical_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_encounters_appointment_id_key" ON "public"."clinical_encounters"("appointment_id");

-- CreateIndex
CREATE INDEX "clinical_encounters_patient_id_created_at_idx" ON "public"."clinical_encounters"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "clinical_encounters_state_updated_at_idx" ON "public"."clinical_encounters"("state", "updated_at");

-- CreateIndex
CREATE INDEX "encounter_assignments_staff_id_status_idx" ON "public"."encounter_assignments"("staff_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_assignments_encounter_id_staff_id_role_status_key" ON "public"."encounter_assignments"("encounter_id", "staff_id", "role", "status");

-- CreateIndex
CREATE INDEX "pregnancy_episodes_patient_id_status_idx" ON "public"."pregnancy_episodes"("patient_id", "status");

-- CreateIndex
CREATE INDEX "vital_signs_encounter_id_recorded_at_idx" ON "public"."vital_signs"("encounter_id", "recorded_at");

-- CreateIndex
CREATE INDEX "clinical_notes_encounter_id_created_at_idx" ON "public"."clinical_notes"("encounter_id", "created_at");

-- CreateIndex
CREATE INDEX "diagnoses_encounter_id_idx" ON "public"."diagnoses"("encounter_id");

-- CreateIndex
CREATE INDEX "clinical_service_orders_encounter_id_status_idx" ON "public"."clinical_service_orders"("encounter_id", "status");

-- CreateIndex
CREATE INDEX "external_clinical_references_encounter_id_idx" ON "public"."external_clinical_references"("encounter_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_clinical_references_resource_type_resource_id_key" ON "public"."external_clinical_references"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "encounter_amendments_encounter_id_created_at_idx" ON "public"."encounter_amendments"("encounter_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "medical_idempotency_scope_key_key" ON "public"."medical_idempotency"("scope", "key");

-- CreateIndex
CREATE INDEX "medical_audit_encounter_id_created_at_idx" ON "public"."medical_audit"("encounter_id", "created_at");

-- CreateIndex
CREATE INDEX "medical_outbox_status_occurred_at_idx" ON "public"."medical_outbox"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."clinical_encounters" ADD CONSTRAINT "clinical_encounters_pregnancy_episode_id_fkey" FOREIGN KEY ("pregnancy_episode_id") REFERENCES "public"."pregnancy_episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."encounter_assignments" ADD CONSTRAINT "encounter_assignments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vital_signs" ADD CONSTRAINT "vital_signs_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clinical_notes" ADD CONSTRAINT "clinical_notes_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."diagnoses" ADD CONSTRAINT "diagnoses_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clinical_service_orders" ADD CONSTRAINT "clinical_service_orders_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_clinical_references" ADD CONSTRAINT "external_clinical_references_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."encounter_amendments" ADD CONSTRAINT "encounter_amendments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
