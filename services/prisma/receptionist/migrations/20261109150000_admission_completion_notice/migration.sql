ALTER TABLE admissions
  ADD COLUMN queue_ticket_code VARCHAR(100),
  ADD COLUMN queue_room_code VARCHAR(100),
  ADD COLUMN notification_dismissed_at TIMESTAMPTZ(6);

CREATE TABLE reception_appointment_operations (
  appointment_id UUID PRIMARY KEY,
  token UUID NOT NULL UNIQUE,
  account_id UUID NOT NULL,
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
