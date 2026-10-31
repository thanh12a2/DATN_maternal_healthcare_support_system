-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."reporting_consumed_events" (
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_consumed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "public"."daily_metrics" (
    "id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "report_type" VARCHAR(80) NOT NULL,
    "dimension_key" VARCHAR(200) NOT NULL,
    "dimensions" JSONB NOT NULL,
    "measures" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_export_jobs" (
    "id" UUID NOT NULL,
    "requested_by_actor_id" UUID NOT NULL,
    "report_type" VARCHAR(80) NOT NULL,
    "filters" JSONB NOT NULL,
    "status" "public"."ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "storage_key" VARCHAR(300),
    "error_code" VARCHAR(80),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_metrics_report_type_business_date_idx" ON "public"."daily_metrics"("report_type", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_business_date_report_type_dimension_key_key" ON "public"."daily_metrics"("business_date", "report_type", "dimension_key");

-- CreateIndex
CREATE INDEX "report_export_jobs_requested_by_actor_id_created_at_idx" ON "public"."report_export_jobs"("requested_by_actor_id", "created_at");
