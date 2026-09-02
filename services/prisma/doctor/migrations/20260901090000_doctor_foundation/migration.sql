-- Doctor Service owns this database. No appointment, patient, or medical-record tables.
CREATE TYPE "DoctorStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "SpecialtyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "AvailabilityType" AS ENUM ('UNAVAILABLE', 'EXTRA_AVAILABLE');
CREATE TYPE "AvailabilityStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "AvailabilityReasonCode" AS ENUM ('SICK_LEAVE', 'PERSONAL_LEAVE', 'TRAINING', 'EMERGENCY', 'EXTRA_SHIFT', 'OTHER');

CREATE TABLE "doctors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "account_id" UUID NOT NULL,
  "license_number" VARCHAR(50) NOT NULL, "status" "DoctorStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "doctors_account_id_key" ON "doctors"("account_id");
CREATE UNIQUE INDEX "doctors_license_number_key" ON "doctors"("license_number");

CREATE TABLE "doctor_profiles" (
  "doctor_id" UUID NOT NULL, "full_name" VARCHAR(150) NOT NULL, "professional_title" VARCHAR(100),
  "biography" VARCHAR(2000), "practice_start_year" INTEGER, "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "photo_url" VARCHAR(2048), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("doctor_id")
);

CREATE TABLE "specialties" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "code" VARCHAR(50) NOT NULL, "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(1000), "status" "SpecialtyStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");
CREATE UNIQUE INDEX "specialties_name_ci_key" ON "specialties"(LOWER("name"));

CREATE TABLE "doctor_specialties" (
  "doctor_id" UUID NOT NULL, "specialty_id" UUID NOT NULL, "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_specialties_pkey" PRIMARY KEY ("doctor_id", "specialty_id")
);
CREATE INDEX "doctor_specialties_specialty_id_idx" ON "doctor_specialties"("specialty_id");
CREATE UNIQUE INDEX "doctor_specialties_primary_key" ON "doctor_specialties"("doctor_id") WHERE "is_primary" = true;

CREATE TABLE "doctor_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "doctor_id" UUID NOT NULL, "day_of_week" SMALLINT NOT NULL,
  "start_time" VARCHAR(8) NOT NULL, "end_time" VARCHAR(8) NOT NULL, "slot_duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "effective_from" DATE NOT NULL, "effective_to" DATE, "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
  "department_id" UUID, "room_id" UUID, "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE', "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_schedules_day_check" CHECK ("day_of_week" BETWEEN 1 AND 7),
  CONSTRAINT "doctor_schedules_time_check" CHECK ("start_time" < "end_time"),
  CONSTRAINT "doctor_schedules_date_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from")
);
CREATE INDEX "doctor_schedules_lookup_idx" ON "doctor_schedules"("doctor_id", "status", "day_of_week", "effective_from", "effective_to");

CREATE TABLE "doctor_availabilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "doctor_id" UUID NOT NULL, "type" "AvailabilityType" NOT NULL,
  "start_at" TIMESTAMPTZ(6) NOT NULL, "end_at" TIMESTAMPTZ(6) NOT NULL, "reason_code" "AvailabilityReasonCode" NOT NULL,
  "note" VARCHAR(500), "status" "AvailabilityStatus" NOT NULL DEFAULT 'ACTIVE', "created_by" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "doctor_availabilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_availabilities_time_check" CHECK ("start_at" < "end_at")
);
CREATE INDEX "doctor_availabilities_lookup_idx" ON "doctor_availabilities"("doctor_id", "status", "start_at", "end_at");

CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "key" VARCHAR(128) NOT NULL, "endpoint" VARCHAR(255) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL, "status_code" INTEGER NOT NULL, "response_body" JSONB NOT NULL,
  "doctor_id" UUID, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_records_endpoint_key_key" ON "idempotency_records"("endpoint", "key");
CREATE INDEX "idempotency_records_created_at_idx" ON "idempotency_records"("created_at");

CREATE TABLE "audit_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "event_type" VARCHAR(100) NOT NULL, "actor_id" UUID,
  "doctor_id" UUID, "resource_id" UUID, "request_id" UUID, "details" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_records_doctor_created_idx" ON "audit_records"("doctor_id", "created_at");
CREATE INDEX "audit_records_event_created_idx" ON "audit_records"("event_type", "created_at");

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "event_type" VARCHAR(100) NOT NULL, "aggregate_type" VARCHAR(100) NOT NULL,
  "aggregate_id" UUID NOT NULL, "aggregate_version" INTEGER NOT NULL, "correlation_id" UUID, "payload" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbox_events_status_occurred_idx" ON "outbox_events"("status", "occurred_at");
CREATE INDEX "outbox_events_aggregate_version_idx" ON "outbox_events"("aggregate_id", "aggregate_version");

ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_specialties" ADD CONSTRAINT "doctor_specialties_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_specialties" ADD CONSTRAINT "doctor_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_availabilities" ADD CONSTRAINT "doctor_availabilities_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_aggregate_id_fkey" FOREIGN KEY ("aggregate_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
