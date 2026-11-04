-- Attempts are stored separately so failed/cancelled attempts do not occupy
-- the one-Payment-per-invoice slot.

CREATE TYPE "public"."PaymentAttemptStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'EXPIRED'
);

CREATE TABLE "public"."payment_attempts" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "txn_ref" VARCHAR(100) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "status" "public"."PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "return_path" VARCHAR(1024),
    "gateway_transaction_no" VARCHAR(100),
    "bank_transaction_no" VARCHAR(100),
    "response_code" VARCHAR(10),
    "created_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_attempts_amount_minor_check" CHECK ("amount_minor" > 0)
);

CREATE UNIQUE INDEX "payment_attempts_txn_ref_key"
    ON "public"."payment_attempts"("txn_ref");

CREATE INDEX "payment_attempts_invoice_id_status_created_at_idx"
    ON "public"."payment_attempts"("invoice_id", "status", "created_at");

CREATE INDEX "payment_attempts_status_expires_at_idx"
    ON "public"."payment_attempts"("status", "expires_at");

ALTER TABLE "public"."payment_attempts"
    ADD CONSTRAINT "payment_attempts_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
