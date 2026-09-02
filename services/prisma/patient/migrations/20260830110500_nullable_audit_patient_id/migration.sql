-- Search and denied-access audits may not have a Patient resource to reference.
ALTER TABLE "patient_audit_logs" ALTER COLUMN "patient_id" DROP NOT NULL;
