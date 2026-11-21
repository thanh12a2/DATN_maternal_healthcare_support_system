CREATE TABLE notification_email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  kind VARCHAR(40) NOT NULL,
  appointment_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  encounter_id UUID,
  occurred_at TIMESTAMPTZ(6) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  last_error VARCHAR(100),
  provider_message_id VARCHAR(200),
  sent_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT notification_email_jobs_event_id_kind_key UNIQUE (event_id, kind)
);
CREATE INDEX notification_email_jobs_status_next_attempt_at_idx ON notification_email_jobs(status, next_attempt_at);
