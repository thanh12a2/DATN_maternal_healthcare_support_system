ALTER TABLE "public"."stage_tickets"
  ADD COLUMN IF NOT EXISTS "room_code" VARCHAR(50);

