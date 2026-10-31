-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."NotificationCategory" AS ENUM ('BOOKING', 'REMINDER', 'REASSIGNMENT', 'QUEUE', 'PAYMENT', 'RESULT');

-- CreateEnum
CREATE TYPE "public"."DeliveryChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "recipient_account_id" UUID NOT NULL,
    "template_code" VARCHAR(80) NOT NULL,
    "category" "public"."NotificationCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" UUID,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_attempts" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "public"."DeliveryChannel" NOT NULL,
    "status" "public"."DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "provider_message_id" VARCHAR(200),
    "last_error_code" VARCHAR(100),
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_consumed_events" (
    "event_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_consumed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_account_id_created_at_idx" ON "public"."notifications"("recipient_account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_source_event_id_recipient_account_id_template_key" ON "public"."notifications"("source_event_id", "recipient_account_id", "template_code");

-- CreateIndex
CREATE INDEX "delivery_attempts_status_attempted_at_idx" ON "public"."delivery_attempts"("status", "attempted_at");

-- AddForeignKey
ALTER TABLE "public"."delivery_attempts" ADD CONSTRAINT "delivery_attempts_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
