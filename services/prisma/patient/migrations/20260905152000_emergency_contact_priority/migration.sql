-- Preserve existing contacts while assigning a deterministic priority per Patient.
ALTER TABLE "emergency_contacts" ADD COLUMN "priority" INTEGER;

WITH ranked_contacts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "patient_id"
      ORDER BY "is_primary" DESC, "created_at" ASC, "id" ASC
    ) AS "priority"
  FROM "emergency_contacts"
)
UPDATE "emergency_contacts" AS contact
SET "priority" = ranked."priority"
FROM ranked_contacts AS ranked
WHERE contact."id" = ranked."id";

-- Make the compatibility flag reflect the new ordering invariant, including
-- legacy Patients that previously had contacts but no primary contact.
UPDATE "emergency_contacts"
SET "is_primary" = ("priority" = 1);

ALTER TABLE "emergency_contacts"
  ALTER COLUMN "priority" SET DEFAULT 1,
  ALTER COLUMN "priority" SET NOT NULL;

CREATE INDEX "emergency_contacts_patient_priority_idx"
  ON "emergency_contacts"("patient_id", "priority");
