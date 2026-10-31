-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "MedicalServiceKind" AS ENUM ('CONSULTATION', 'DIAGNOSTIC', 'PROCEDURE', 'PACKAGE', 'VACCINATION', 'OTHER');
CREATE TYPE "TagGroup" AS ENUM ('AGE', 'GENDER', 'AUDIENCE', 'FEATURE', 'LABEL');
CREATE TYPE "PriceStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "DoctorRankSelectionPolicy" AS ENUM ('NOT_REQUIRED', 'BASIC_INCLUDED', 'RANK_UPGRADE_ALLOWED');

-- CreateTable
CREATE TABLE "medical_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500),
    "description" TEXT,
    "kind" "MedicalServiceKind" NOT NULL,
    "specialty_id" UUID,
    "thumbnail_url" VARCHAR(2048),
    "duration_minutes" INTEGER,
    "booking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "doctor_rank_selection_policy" "DoctorRankSelectionPolicy" NOT NULL DEFAULT 'NOT_REQUIRED',
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "medical_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "parent_id" UUID,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "group" "TagGroup" NOT NULL,
    "description" VARCHAR(500),
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "catalog_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medical_service_categories" (
    "medical_service_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medical_service_categories_pkey" PRIMARY KEY ("medical_service_id","category_id")
);

CREATE TABLE "medical_service_tags" (
    "medical_service_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medical_service_tags_pkey" PRIMARY KEY ("medical_service_id","tag_id")
);

CREATE TABLE "base_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "medical_service_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "status" "PriceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "base_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_rank_surcharges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rank_code" VARCHAR(50) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "status" "PriceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "doctor_rank_surcharges_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "medical_services_code_key" ON "medical_services"("code");
CREATE UNIQUE INDEX "medical_services_slug_key" ON "medical_services"("slug");
CREATE INDEX "medical_services_status_booking_idx" ON "medical_services"("status", "booking_enabled");
CREATE INDEX "medical_services_kind_status_idx" ON "medical_services"("kind", "status");
CREATE INDEX "medical_services_specialty_id_idx" ON "medical_services"("specialty_id");

CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");
CREATE INDEX "service_categories_status_sort_idx" ON "service_categories"("status", "sort_order");
CREATE INDEX "service_categories_parent_id_idx" ON "service_categories"("parent_id");

CREATE UNIQUE INDEX "catalog_tags_code_key" ON "catalog_tags"("code");
CREATE UNIQUE INDEX "catalog_tags_slug_key" ON "catalog_tags"("slug");
CREATE INDEX "catalog_tags_status_group_sort_idx" ON "catalog_tags"("status", "group", "sort_order");

CREATE INDEX "medical_service_categories_category_id_idx" ON "medical_service_categories"("category_id");
CREATE UNIQUE INDEX "medical_service_categories_one_primary_idx" ON "medical_service_categories"("medical_service_id") WHERE "is_primary" = true;
CREATE INDEX "medical_service_tags_tag_id_idx" ON "medical_service_tags"("tag_id");
CREATE INDEX "base_prices_lookup_idx" ON "base_prices"("medical_service_id", "currency", "status", "effective_from", "effective_to");
CREATE INDEX "doctor_rank_surcharges_lookup_idx" ON "doctor_rank_surcharges"("rank_code", "currency", "status", "effective_from", "effective_to");

-- Foreign keys
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_service_categories" ADD CONSTRAINT "medical_service_categories_medical_service_id_fkey" FOREIGN KEY ("medical_service_id") REFERENCES "medical_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_service_categories" ADD CONSTRAINT "medical_service_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_service_tags" ADD CONSTRAINT "medical_service_tags_medical_service_id_fkey" FOREIGN KEY ("medical_service_id") REFERENCES "medical_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_service_tags" ADD CONSTRAINT "medical_service_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "catalog_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "base_prices" ADD CONSTRAINT "base_prices_medical_service_id_fkey" FOREIGN KEY ("medical_service_id") REFERENCES "medical_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Basic money/time constraints
ALTER TABLE "base_prices" ADD CONSTRAINT "base_prices_amount_non_negative_chk" CHECK ("amount_minor" >= 0);
ALTER TABLE "base_prices" ADD CONSTRAINT "base_prices_interval_chk" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "doctor_rank_surcharges" ADD CONSTRAINT "doctor_rank_surcharges_amount_non_negative_chk" CHECK ("amount_minor" >= 0);
ALTER TABLE "doctor_rank_surcharges" ADD CONSTRAINT "doctor_rank_surcharges_interval_chk" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
