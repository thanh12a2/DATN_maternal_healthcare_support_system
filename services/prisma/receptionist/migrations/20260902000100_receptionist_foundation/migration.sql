CREATE TYPE "ReceptionistStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "ReceptionCaseType" AS ENUM ('SCHEDULED', 'WALK_IN');
CREATE TYPE "ReceptionCaseStatus" AS ENUM ('OPEN', 'IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS', 'ADMITTED', 'CANCELLED', 'MANUAL_REVIEW');
CREATE TYPE "IdentityVerificationMethod" AS ENUM ('APPOINTMENT_CODE', 'PHONE_AND_DOB', 'NATIONAL_ID_DOCUMENT', 'OTHER_DOCUMENT');
CREATE TYPE "IdentityVerificationResult" AS ENUM ('VERIFIED', 'MISMATCH', 'INCONCLUSIVE');
CREATE TYPE "AdmissionStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_PAYMENT', 'FAILED_RETRYABLE', 'COMPLETED', 'CANCELLED', 'MANUAL_REVIEW');
CREATE TYPE "AdmissionStep" AS ENUM ('VALIDATE_APPOINTMENT', 'CREATE_INVOICE', 'VERIFY_PAYMENT', 'OPEN_MEDICAL_RECORD', 'CHECK_IN_APPOINTMENT', 'CREATE_QUEUE_TICKET', 'DONE');

CREATE TABLE "receptionists" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "employee_code" VARCHAR(30) NOT NULL,
  "status" "ReceptionistStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_account_id" UUID NOT NULL,
  "updated_by_account_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receptionists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receptionists_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "receptionist_profiles" (
  "receptionist_id" UUID NOT NULL,
  "full_name" VARCHAR(150) NOT NULL,
  "work_phone" VARCHAR(20),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receptionist_profiles_pkey" PRIMARY KEY ("receptionist_id")
);

CREATE TABLE "reception_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ReceptionCaseType" NOT NULL DEFAULT 'SCHEDULED',
  "appointment_id" UUID,
  "patient_id" UUID NOT NULL,
  "status" "ReceptionCaseStatus" NOT NULL DEFAULT 'OPEN',
  "arrival_at" TIMESTAMPTZ(6) NOT NULL,
  "scheduled_start_at_snapshot" TIMESTAMPTZ(6),
  "appointment_type_snapshot" VARCHAR(50),
  "opened_by_account_id" UUID NOT NULL,
  "last_handled_by_account_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reception_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reception_cases_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "identity_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reception_case_id" UUID NOT NULL,
  "method" "IdentityVerificationMethod" NOT NULL,
  "result" "IdentityVerificationResult" NOT NULL,
  "reason_code" VARCHAR(50),
  "note" VARCHAR(500),
  "verified_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "performed_by_account_id" UUID NOT NULL,
  "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reception_case_id" UUID NOT NULL,
  "status" "AdmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "current_step" "AdmissionStep" NOT NULL DEFAULT 'VALIDATE_APPOINTMENT',
  "invoice_id" UUID,
  "payment_id" UUID,
  "medical_record_id" UUID,
  "queue_ticket_id" UUID,
  "appointment_checked_in_at" TIMESTAMPTZ(6),
  "last_error_code" VARCHAR(100),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "admissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admissions_version_check" CHECK ("version" >= 1),
  CONSTRAINT "admissions_retry_count_check" CHECK ("retry_count" >= 0)
);

CREATE TABLE "admission_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admission_id" UUID NOT NULL,
  "from_status" "AdmissionStatus" NOT NULL,
  "to_status" "AdmissionStatus" NOT NULL,
  "step" "AdmissionStep" NOT NULL,
  "actor_id" UUID,
  "reason_code" VARCHAR(100),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reception_idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID NOT NULL,
  "operation" VARCHAR(100) NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "resource_id" UUID,
  "response_status" INTEGER NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reception_idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reception_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(100) NOT NULL,
  "actor_id" UUID NOT NULL,
  "receptionist_id" UUID,
  "case_id" UUID,
  "admission_id" UUID,
  "changed_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason_code" VARCHAR(100),
  "request_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reception_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receptionists_account_id_key" ON "receptionists"("account_id");
CREATE UNIQUE INDEX "receptionists_employee_code_key" ON "receptionists"("employee_code");
CREATE INDEX "reception_cases_status_arrival_idx" ON "reception_cases"("status", "arrival_at");
CREATE UNIQUE INDEX "reception_cases_active_appointment_key" ON "reception_cases"("appointment_id") WHERE "appointment_id" IS NOT NULL AND "status" <> 'CANCELLED';
CREATE INDEX "identity_verifications_case_time_idx" ON "identity_verifications"("reception_case_id", "performed_at");
CREATE UNIQUE INDEX "admissions_reception_case_id_key" ON "admissions"("reception_case_id");
CREATE INDEX "admissions_recovery_idx" ON "admissions"("status", "current_step", "updated_at");
CREATE INDEX "admission_status_history_time_idx" ON "admission_status_history"("admission_id", "occurred_at");
CREATE UNIQUE INDEX "reception_idempotency_actor_operation_key" ON "reception_idempotency_records"("actor_id", "operation", "idempotency_key");
CREATE INDEX "reception_idempotency_expiry_idx" ON "reception_idempotency_records"("expires_at");
CREATE INDEX "reception_audit_receptionist_time_idx" ON "reception_audit_logs"("receptionist_id", "created_at");
CREATE INDEX "reception_audit_case_time_idx" ON "reception_audit_logs"("case_id", "created_at");

ALTER TABLE "receptionist_profiles" ADD CONSTRAINT "receptionist_profiles_receptionist_id_fkey" FOREIGN KEY ("receptionist_id") REFERENCES "receptionists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_reception_case_id_fkey" FOREIGN KEY ("reception_case_id") REFERENCES "reception_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_reception_case_id_fkey" FOREIGN KEY ("reception_case_id") REFERENCES "reception_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_status_history" ADD CONSTRAINT "admission_status_history_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
