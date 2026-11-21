CREATE TABLE clinical_file_upload_locks (
  encounter_id UUID PRIMARY KEY REFERENCES clinical_encounters(id) ON DELETE RESTRICT,
  token UUID NOT NULL UNIQUE,
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
