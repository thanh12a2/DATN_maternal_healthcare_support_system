CREATE TABLE clinical_email_relay_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled_from TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
INSERT INTO clinical_email_relay_settings(id) VALUES (1);
CREATE TABLE clinical_email_relay_published (
  event_id UUID PRIMARY KEY,
  published_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
