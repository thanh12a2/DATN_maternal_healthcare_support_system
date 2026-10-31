-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."InvoiceType" AS ENUM ('BASE', 'SUPPLEMENTARY');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('OPEN', 'PAYMENT_PENDING_VERIFICATION', 'PAID', 'CREDIT_APPROVED', 'OUTSTANDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'MANUAL_BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('RECORDED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."CreditApprovalStatus" AS ENUM ('APPROVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."LineSource" AS ENUM ('APPOINTMENT_SNAPSHOT', 'PERFORMED_SERVICE');

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" UUID NOT NULL,
    "invoice_number" VARCHAR(24) NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "encounter_id" UUID,
    "type" "public"."InvoiceType" NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "subtotal_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL DEFAULT 0,
    "paid_minor" BIGINT NOT NULL DEFAULT 0,
    "balance_minor" BIGINT NOT NULL DEFAULT 0,
    "source_version" BIGINT NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "source" "public"."LineSource" NOT NULL,
    "source_reference_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "description_snapshot" VARCHAR(300) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_amount_minor" BIGINT NOT NULL,
    "line_amount_minor" BIGINT NOT NULL,
    "price_reference_id" UUID,
    "performed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "reference" VARCHAR(100),
    "recorded_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_approvals" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "status" "public"."CreditApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "reason_code" VARCHAR(80) NOT NULL,
    "reason_text" VARCHAR(500) NOT NULL,
    "approved_by" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "credit_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_idempotency_records" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "resource_id" UUID,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_audit_logs" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "actor_id" UUID,
    "invoice_id" UUID,
    "reason" VARCHAR(500),
    "request_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "billing_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "public"."invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_patient_id_created_at_idx" ON "public"."invoices"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_status_due_at_idx" ON "public"."invoices"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_appointment_id_type_key" ON "public"."invoices"("appointment_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_line_no_key" ON "public"."invoice_lines"("invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_source_source_reference_id_key" ON "public"."invoice_lines"("source", "source_reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_id_key" ON "public"."payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "public"."payments"("reference");

-- CreateIndex
CREATE INDEX "credit_approvals_invoice_id_status_idx" ON "public"."credit_approvals"("invoice_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_idempotency_records_scope_key_key" ON "public"."billing_idempotency_records"("scope", "key");

-- CreateIndex
CREATE INDEX "billing_audit_logs_invoice_id_created_at_idx" ON "public"."billing_audit_logs"("invoice_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_outbox_events_status_occurred_at_idx" ON "public"."billing_outbox_events"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_approvals" ADD CONSTRAINT "credit_approvals_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
