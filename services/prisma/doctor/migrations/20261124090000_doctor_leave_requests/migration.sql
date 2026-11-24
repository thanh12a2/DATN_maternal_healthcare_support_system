CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "doctor_leave_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "doctor_id" UUID NOT NULL,
  "schedule_id" UUID NOT NULL,
  "work_date" DATE NOT NULL,
  "start_at" TIMESTAMPTZ(6) NOT NULL,
  "end_at" TIMESTAMPTZ(6) NOT NULL,
  "reason_code" "AvailabilityReasonCode" NOT NULL,
  "note" VARCHAR(500),
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "availability_id" UUID,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "review_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_leave_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_leave_requests_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "doctor_leave_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "doctor_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "doctor_leave_requests_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "doctor_availabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "doctor_leave_requests_availability_id_key" ON "doctor_leave_requests"("availability_id");
CREATE INDEX "doctor_leave_requests_doctor_id_status_work_date_idx" ON "doctor_leave_requests"("doctor_id", "status", "work_date");
CREATE INDEX "doctor_leave_requests_status_created_at_idx" ON "doctor_leave_requests"("status", "created_at");
CREATE UNIQUE INDEX "doctor_leave_requests_open_shift_key" ON "doctor_leave_requests"("schedule_id", "work_date") WHERE "status" IN ('PENDING', 'APPROVED');
