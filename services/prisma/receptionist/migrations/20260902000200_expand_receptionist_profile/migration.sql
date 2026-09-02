CREATE TYPE "ReceptionistGender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

ALTER TABLE "receptionist_profiles"
  ADD COLUMN "login_email" VARCHAR(255),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "department" VARCHAR(100),
  ADD COLUMN "gender" "ReceptionistGender",
  ADD COLUMN "avatar_url" VARCHAR(2048);

CREATE UNIQUE INDEX "receptionist_profiles_login_email_key"
  ON "receptionist_profiles"("login_email");
