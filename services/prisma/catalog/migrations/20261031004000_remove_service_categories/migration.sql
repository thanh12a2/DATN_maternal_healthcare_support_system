-- DropForeignKey
ALTER TABLE "medical_service_categories" DROP CONSTRAINT IF EXISTS "medical_service_categories_category_id_fkey";
ALTER TABLE "medical_service_categories" DROP CONSTRAINT IF EXISTS "medical_service_categories_medical_service_id_fkey";
ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_parent_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "medical_service_categories" CASCADE;
DROP TABLE IF EXISTS "service_categories" CASCADE;

