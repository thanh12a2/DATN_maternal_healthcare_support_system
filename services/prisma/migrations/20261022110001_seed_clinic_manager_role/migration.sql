INSERT INTO "roles" ("code", "description")
VALUES ('CLINIC_MANAGER', 'Clinic operations manager')
ON CONFLICT ("code") DO NOTHING;
