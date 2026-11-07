CREATE TABLE "notification_relay_settings" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "enabled_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_relay_singleton" CHECK ("id" = 1)
);
INSERT INTO "notification_relay_settings" ("id") VALUES (1);
CREATE TABLE "notification_relay_published" (
  "event_id" UUID NOT NULL PRIMARY KEY REFERENCES "billing_outbox_events"("id"),
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);