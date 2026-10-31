-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."JourneyState" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TicketState" AS ENUM ('WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."BasePriority" AS ENUM ('ROUTINE', 'URGENT');

-- CreateTable
CREATE TABLE "public"."queue_journeys" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_demoted" BOOLEAN NOT NULL DEFAULT false,
    "state" "public"."JourneyState" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "queue_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."queue_stages" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "room_code" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stage_tickets" (
    "id" UUID NOT NULL,
    "journey_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "source_order_id" UUID,
    "business_date" DATE NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "ticket_code" VARCHAR(30) NOT NULL,
    "state" "public"."TicketState" NOT NULL DEFAULT 'WAITING',
    "base_priority" "public"."BasePriority" NOT NULL DEFAULT 'ROUTINE',
    "late_demotion" BOOLEAN NOT NULL DEFAULT false,
    "enqueue_sequence" BIGINT NOT NULL,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "called_at" TIMESTAMPTZ(6),
    "call_expires_at" TIMESTAMPTZ(6),
    "service_started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stage_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."call_attempts" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "called_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "outcome" VARCHAR(30),
    "caller_account_id" UUID NOT NULL,
    "room_code" VARCHAR(50),

    CONSTRAINT "call_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."queue_idempotency" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."queue_audit" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "actor_id" UUID,
    "ticket_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."queue_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "queue_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "queue_journeys_appointment_id_key" ON "public"."queue_journeys"("appointment_id");

-- CreateIndex
CREATE INDEX "queue_journeys_patient_id_created_at_idx" ON "public"."queue_journeys"("patient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "queue_stages_code_key" ON "public"."queue_stages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "stage_tickets_source_order_id_key" ON "public"."stage_tickets"("source_order_id");

-- CreateIndex
CREATE INDEX "stage_tickets_stage_id_state_base_priority_late_demotion_en_idx" ON "public"."stage_tickets"("stage_id", "state", "base_priority", "late_demotion", "enqueue_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "stage_tickets_stage_id_business_date_ordinal_key" ON "public"."stage_tickets"("stage_id", "business_date", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "stage_tickets_stage_id_business_date_ticket_code_key" ON "public"."stage_tickets"("stage_id", "business_date", "ticket_code");

-- CreateIndex
CREATE UNIQUE INDEX "call_attempts_ticket_id_attempt_number_key" ON "public"."call_attempts"("ticket_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "queue_idempotency_scope_key_key" ON "public"."queue_idempotency"("scope", "key");

-- CreateIndex
CREATE INDEX "queue_audit_ticket_id_created_at_idx" ON "public"."queue_audit"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "queue_outbox_status_occurred_at_idx" ON "public"."queue_outbox"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."stage_tickets" ADD CONSTRAINT "stage_tickets_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "public"."queue_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stage_tickets" ADD CONSTRAINT "stage_tickets_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."queue_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_attempts" ADD CONSTRAINT "call_attempts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."stage_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
