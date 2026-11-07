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

-- Seed the rank catalog before adding the foreign key from existing doctors.
INSERT INTO "consultation_ranks" ("code", "name", "short_name", "experience_years_min", "sort_order", "status")
VALUES
    ('BASIC', 'Bác sĩ Sản Phụ khoa', 'Bác sĩ', 3, 1, 'ACTIVE'),
    ('SPECIALIST_I', 'Bác sĩ Chuyên khoa I (CKI)', 'BS. CKI', 6, 2, 'ACTIVE'),
    ('SPECIALIST_II', 'Bác sĩ Chuyên khoa II (CKII)', 'BS. CKII', 12, 3, 'ACTIVE'),
    ('MASTER', 'Thạc sĩ Bác sĩ', 'ThS. BS', 8, 4, 'ACTIVE'),
    ('HEAD_DOCTOR', 'Bác sĩ Trưởng khoa', 'Trưởng khoa', 15, 5, 'ACTIVE'),
    ('ASSOC_PROFESSOR', 'Phó Giáo sư, Tiến sĩ Bác sĩ', 'PGS. TS. BS', 18, 6, 'ACTIVE'),
    ('EXPERT', 'Bác sĩ Chuyên gia cao cấp', 'Chuyên gia', 20, 7, 'ACTIVE'),
    ('PROFESSOR', 'Giáo sư, Tiến sĩ Bác sĩ', 'GS. TS. BS', 22, 8, 'ACTIVE');

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_consultation_rank_fkey" FOREIGN KEY ("consultation_rank") REFERENCES "consultation_ranks"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop professional_title column from doctor_profiles
ALTER TABLE "doctor_profiles" DROP COLUMN IF EXISTS "professional_title";
