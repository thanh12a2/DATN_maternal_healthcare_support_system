CREATE TABLE "notification_pending_events" (
  "event_id" UUID NOT NULL PRIMARY KEY,
  "event_type" VARCHAR(120) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(120),
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notification_pending_events_status_next_attempt_at_idx" ON "notification_pending_events" ("status", "next_attempt_at");
