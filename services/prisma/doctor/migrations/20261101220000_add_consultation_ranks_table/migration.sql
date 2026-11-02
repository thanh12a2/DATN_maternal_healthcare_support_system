-- CreateTable
CREATE TABLE "consultation_ranks" (
    "code" "DoctorConsultationRank" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "short_name" VARCHAR(50) NOT NULL,
    "experience_years_min" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_ranks_pkey" PRIMARY KEY ("code")
);

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_consultation_rank_fkey" FOREIGN KEY ("consultation_rank") REFERENCES "consultation_ranks"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop professional_title column from doctor_profiles
ALTER TABLE "doctor_profiles" DROP COLUMN IF EXISTS "professional_title";

