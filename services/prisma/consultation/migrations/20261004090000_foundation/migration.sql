-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ConsultationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'ANSWERED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "public"."consultation_threads" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID,
    "subject" VARCHAR(160) NOT NULL,
    "status" "public"."ConsultationStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_doctor_id" UUID,
    "last_sequence_no" BIGINT NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(6),
    "created_by_account_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consultation_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consultation_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "sequence_no" BIGINT NOT NULL,
    "sender_account_id" UUID NOT NULL,
    "sender_type" VARCHAR(30) NOT NULL,
    "client_message_id" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "body_hash" CHAR(64) NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consultation_assignments" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "consultation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consultation_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_threads_patient_id_updated_at_idx" ON "public"."consultation_threads"("patient_id", "updated_at");

-- CreateIndex
CREATE INDEX "consultation_threads_assigned_doctor_id_status_idx" ON "public"."consultation_threads"("assigned_doctor_id", "status");

-- CreateIndex
CREATE INDEX "consultation_messages_thread_id_sent_at_idx" ON "public"."consultation_messages"("thread_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_messages_thread_id_sequence_no_key" ON "public"."consultation_messages"("thread_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_messages_thread_id_sender_account_id_client_me_key" ON "public"."consultation_messages"("thread_id", "sender_account_id", "client_message_id");

-- CreateIndex
CREATE INDEX "consultation_assignments_doctor_id_status_idx" ON "public"."consultation_assignments"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "consultation_outbox_status_occurred_at_idx" ON "public"."consultation_outbox"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."consultation_messages" ADD CONSTRAINT "consultation_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."consultation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consultation_assignments" ADD CONSTRAINT "consultation_assignments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."consultation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
