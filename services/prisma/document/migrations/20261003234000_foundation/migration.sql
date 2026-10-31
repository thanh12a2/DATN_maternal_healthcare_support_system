-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'SCANNING', 'CLEAN', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."UploadStatus" AS ENUM ('OPEN', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL,
    "owner_type" VARCHAR(50) NOT NULL,
    "owner_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "visibility" VARCHAR(30) NOT NULL DEFAULT 'CLINICAL_TEAM',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_by_account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "media_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "scan_status" "public"."ScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMPTZ(6),
    "scanned_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."upload_sessions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "expected_media_type" VARCHAR(100) NOT NULL,
    "max_bytes" BIGINT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "public"."UploadStatus" NOT NULL DEFAULT 'OPEN',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_owner_type_owner_id_idx" ON "public"."documents"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "documents_patient_id_status_idx" ON "public"."documents"("patient_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_storage_key_key" ON "public"."document_versions"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_key" ON "public"."document_versions"("document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_idempotency_key_key" ON "public"."upload_sessions"("idempotency_key");

-- CreateIndex
CREATE INDEX "upload_sessions_status_expires_at_idx" ON "public"."upload_sessions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "document_outbox_status_occurred_at_idx" ON "public"."document_outbox"("status", "occurred_at");

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."upload_sessions" ADD CONSTRAINT "upload_sessions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
