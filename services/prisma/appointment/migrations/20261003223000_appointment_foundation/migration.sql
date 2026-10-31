-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BookingChannel" AS ENUM ('ONLINE', 'RECEPTION', 'WALK_IN');

-- CreateEnum
CREATE TYPE "public"."SelectionMode" AS ENUM ('DOCTOR', 'RANK');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('BOOKED', 'REASSIGNMENT_REQUIRED', 'CHECKED_IN', 'IN_CLINICAL_CARE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "public"."SlotHoldStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'RELEASED');

-- CreateTable
CREATE TABLE "public"."appointments" (
    "id" UUID NOT NULL,
    "appointment_code" VARCHAR(24) NOT NULL,
    "patient_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "channel" "public"."BookingChannel" NOT NULL,
    "selection_mode" "public"."SelectionMode" NOT NULL,
    "requested_doctor_id" UUID,
    "requested_rank_code" VARCHAR(50),
    "assigned_doctor_id" UUID NOT NULL,
    "assigned_rank_code" VARCHAR(50) NOT NULL,
    "specialty_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "service_name_snapshot" VARCHAR(200) NOT NULL,
    "service_version" INTEGER NOT NULL,
    "base_price_id" UUID NOT NULL,
    "base_amount_minor" BIGINT NOT NULL,
    "rank_surcharge_price_id" UUID,
    "rank_surcharge_amount_minor" BIGINT NOT NULL,
    "estimated_total_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "queue_estimate_minutes" INTEGER,
    "availability_version" BIGINT NOT NULL,
    "reception_case_id" UUID,
    "encounter_id" UUID,
    "checked_in_at" TIMESTAMPTZ(6),
    "clinical_started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancellation_reason" VARCHAR(500),
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."slot_holds" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "rank_code" VARCHAR(50) NOT NULL,
    "selection_mode" "public"."SelectionMode" NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "public"."SlotHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_by_appointment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_assignment_history" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "from_doctor_id" UUID,
    "to_doctor_id" UUID NOT NULL,
    "rank_code" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_idempotency_records" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "resource_id" UUID,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_audit_logs" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "actor_id" UUID,
    "resource_id" UUID,
    "reason" VARCHAR(500),
    "request_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "appointment_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointments_appointment_code_key" ON "public"."appointments"("appointment_code");

-- CreateIndex
CREATE INDEX "appointments_patient_id_start_at_idx" ON "public"."appointments"("patient_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_assigned_doctor_id_start_at_end_at_idx" ON "public"."appointments"("assigned_doctor_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "appointments_status_start_at_idx" ON "public"."appointments"("status", "start_at");

-- CreateIndex
CREATE INDEX "slot_holds_doctor_id_start_at_end_at_status_idx" ON "public"."slot_holds"("doctor_id", "start_at", "end_at", "status");

-- CreateIndex
CREATE INDEX "slot_holds_status_expires_at_idx" ON "public"."slot_holds"("status", "expires_at");

-- CreateIndex
CREATE INDEX "appointment_assignment_history_appointment_id_created_at_idx" ON "public"."appointment_assignment_history"("appointment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_idempotency_records_scope_key_key" ON "public"."appointment_idempotency_records"("scope", "key");

-- CreateIndex
CREATE INDEX "appointment_audit_logs_resource_id_created_at_idx" ON "public"."appointment_audit_logs"("resource_id", "created_at");

-- CreateIndex
CREATE INDEX "appointment_outbox_events_status_occurred_at_idx" ON "public"."appointment_outbox_events"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."slot_holds" ADD CONSTRAINT "slot_holds_consumed_by_appointment_id_fkey" FOREIGN KEY ("consumed_by_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_assignment_history" ADD CONSTRAINT "appointment_assignment_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
