-- CreateEnum
CREATE TYPE "public"."PregnancySafetyCategory" AS ENUM ('CATEGORY_A', 'CATEGORY_B', 'CATEGORY_C', 'CATEGORY_D', 'CATEGORY_X');

-- CreateTable
CREATE TABLE "public"."medication_catalog" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active_ingredient" VARCHAR(500) NOT NULL,
    "strength" VARCHAR(100) NOT NULL,
    "dosage_form" VARCHAR(100) NOT NULL,
    "route" VARCHAR(80) NOT NULL,
    "default_dose" VARCHAR(80),
    "default_frequency" VARCHAR(120),
    "default_instruction" VARCHAR(1000),
    "pregnancy_category" "public"."PregnancySafetyCategory" NOT NULL,
    "pregnancy_warning" VARCHAR(2000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medication_catalog_code_key" ON "public"."medication_catalog"("code");

-- CreateIndex
CREATE INDEX "medication_catalog_active_category_name_idx" ON "public"."medication_catalog"("is_active", "pregnancy_category", "name");

-- CreateIndex
CREATE INDEX "medication_catalog_name_idx" ON "public"."medication_catalog"("name");

-- CreateIndex
CREATE INDEX "medication_catalog_ingredient_idx" ON "public"."medication_catalog"("active_ingredient");
