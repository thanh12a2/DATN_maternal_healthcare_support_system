CREATE TABLE reception_work_signal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(20) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reception_work_signal_due_idx ON reception_work_signal_outbox (available_at, id);
CREATE FUNCTION reception_work_signal() RETURNS trigger AS $$
BEGIN
  INSERT INTO reception_work_signal_outbox(category) VALUES ('appointment');
  IF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.reassignment_claim_expires_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.reassignment_claim_expires_at IS DISTINCT FROM OLD.reassignment_claim_expires_at) THEN
      INSERT INTO reception_work_signal_outbox(category, available_at) VALUES ('appointment', NEW.reassignment_claim_expires_at);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER reception_work_signal_appointments AFTER INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION reception_work_signal();
