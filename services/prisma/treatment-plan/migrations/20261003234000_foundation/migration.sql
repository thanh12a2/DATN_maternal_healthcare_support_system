-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."TreatmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TreatmentPlanItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."treatment_plans" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "pregnancy_episode_id" UUID,
    "source_encounter_id" UUID NOT NULL,
    "author_doctor_id" UUID NOT NULL,
    "status" "public"."TreatmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(4000) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."treatment_plan_items" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "status" "public"."TreatmentPlanItemStatus" NOT NULL DEFAULT 'PENDING',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "treatment_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."treatment_plan_versions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changed_by" UUID NOT NULL,
    "change_reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."treatment_plan_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_plan_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_plans_patient_id_status_idx" ON "public"."treatment_plans"("patient_id", "status");

-- CreateIndex
CREATE INDEX "treatment_plans_pregnancy_episode_id_idx" ON "public"."treatment_plans"("pregnancy_episode_id");

-- CreateIndex
CREATE INDEX "treatment_plan_items_plan_id_sort_order_idx" ON "public"."treatment_plan_items"("plan_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_plan_versions_plan_id_version_key" ON "public"."treatment_plan_versions"("plan_id", "version");

-- CreateIndex
CREATE INDEX "treatment_plan_outbox_status_occurred_at_idx" ON "public"."treatment_plan_outbox"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."treatment_plan_versions" ADD CONSTRAINT "treatment_plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
