-- Authentication Service database foundation.
-- Auth Service owns identity, credential metadata, and role assignment data.

CREATE TYPE "AccountStatus" AS ENUM (
  'ACTIVE',
  'LOCKED',
  'DISABLED',
  'PENDING_VERIFICATION'
);

CREATE TYPE "AuthRoleCode" AS ENUM (
  'PATIENT',
  'RECEPTIONIST',
  'DOCTOR',
  'NURSE',
  'ADMIN'
);

CREATE TABLE "accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "last_login_at" TIMESTAMPTZ(6),

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credentials" (
  "account_id" UUID NOT NULL,
  "password_hash" TEXT NOT NULL,
  "password_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),

  CONSTRAINT "credentials_pkey" PRIMARY KEY ("account_id")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" "AuthRoleCode" NOT NULL,
  "description" TEXT,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account_roles" (
  "account_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,

  CONSTRAINT "account_roles_pkey" PRIMARY KEY ("account_id", "role_id")
);

CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

ALTER TABLE "credentials"
  ADD CONSTRAINT "credentials_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_roles"
  ADD CONSTRAINT "account_roles_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_roles"
  ADD CONSTRAINT "account_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "roles" ("code", "description") VALUES
  ('PATIENT', 'Patient / Thai phụ'),
  ('RECEPTIONIST', 'Receptionist / Lễ tân'),
  ('DOCTOR', 'Doctor / Bác sĩ'),
  ('NURSE', 'Nurse or Midwife / Y tá, hộ sinh'),
  ('ADMIN', 'System administrator')
ON CONFLICT ("code") DO NOTHING;
