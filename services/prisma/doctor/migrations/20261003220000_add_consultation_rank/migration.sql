CREATE TYPE "DoctorConsultationRank" AS ENUM ('BASIC', 'SPECIALIST_I', 'SPECIALIST_II', 'MASTER', 'ASSOC_PROFESSOR', 'PROFESSOR', 'EXPERT', 'HEAD_DOCTOR');
ALTER TABLE "doctors" ADD COLUMN "consultation_rank" "DoctorConsultationRank" NOT NULL DEFAULT 'BASIC';
CREATE INDEX "doctors_status_consultation_rank_idx" ON "doctors"("status", "consultation_rank");
ALTER TABLE "doctor_schedules" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Ho_Chi_Minh';
