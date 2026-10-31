-- AlterTable
ALTER TABLE "specialties" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(160);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "specialties_slug_key" ON "specialties"("slug");

