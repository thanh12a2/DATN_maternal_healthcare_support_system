ALTER TABLE "public"."appointments"
  ADD COLUMN IF NOT EXISTS "room_id" UUID,
  ADD COLUMN IF NOT EXISTS "room_code" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "room_name_snapshot" VARCHAR(120);

ALTER TABLE "public"."slot_holds"
  ADD COLUMN IF NOT EXISTS "room_id" UUID,
  ADD COLUMN IF NOT EXISTS "room_code" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "room_name" VARCHAR(120);

CREATE INDEX IF NOT EXISTS "appointments_room_id_start_at_idx" ON "public"."appointments"("room_id", "start_at");

