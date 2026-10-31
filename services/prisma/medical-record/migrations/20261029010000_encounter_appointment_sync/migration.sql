CREATE TABLE "encounter_appointment_sync" (
  "id" UUID NOT NULL,
  "encounter_id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "encounter_version" INTEGER NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(100),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "encounter_appointment_sync_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "encounter_appointment_sync_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "clinical_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "encounter_appointment_sync_encounter_id_encounter_version_key" ON "encounter_appointment_sync"("encounter_id", "encounter_version");
CREATE INDEX "encounter_appointment_sync_status_next_attempt_at_created_at_idx" ON "encounter_appointment_sync"("status", "next_attempt_at", "created_at");
