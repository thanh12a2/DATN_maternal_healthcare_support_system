DO $$ BEGIN
  CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "clinic_rooms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinic_rooms_code_key" ON "clinic_rooms"("code");
CREATE INDEX IF NOT EXISTS "clinic_rooms_status_code_idx" ON "clinic_rooms"("status", "code");

ALTER TABLE "doctor_availabilities" ADD COLUMN IF NOT EXISTS "room_id" UUID;

DO $$ BEGIN
  ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "clinic_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "doctor_availabilities" ADD CONSTRAINT "doctor_availabilities_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "clinic_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "doctor_schedules_room_lookup_idx" ON "doctor_schedules"("room_id", "status", "day_of_week", "effective_from", "effective_to");

