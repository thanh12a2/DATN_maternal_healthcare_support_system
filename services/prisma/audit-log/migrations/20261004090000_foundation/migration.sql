-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."audit_entries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "source_service" VARCHAR(80) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(100) NOT NULL,
    "actor_id" UUID,
    "actor_type" VARCHAR(30) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "result" VARCHAR(30) NOT NULL,
    "patient_id" UUID,
    "changed_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sensitivity" VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    "metadata" JSONB,
    "payload_hash" CHAR(64) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "ingested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_entries_event_id_key" ON "public"."audit_entries"("event_id");

-- CreateIndex
CREATE INDEX "audit_entries_aggregate_type_aggregate_id_occurred_at_idx" ON "public"."audit_entries"("aggregate_type", "aggregate_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_entries_actor_id_occurred_at_idx" ON "public"."audit_entries"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_entries_patient_id_occurred_at_idx" ON "public"."audit_entries"("patient_id", "occurred_at");
