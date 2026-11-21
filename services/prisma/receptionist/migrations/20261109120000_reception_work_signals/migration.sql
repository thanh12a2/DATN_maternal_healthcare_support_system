CREATE TABLE reception_work_signal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(20) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reception_work_signal_due_idx ON reception_work_signal_outbox (available_at, id);
CREATE FUNCTION reception_work_signal() RETURNS trigger AS $$
BEGIN
  INSERT INTO reception_work_signal_outbox(category) VALUES ('case');
  IF TG_TABLE_NAME = 'reception_cases' THEN
    IF NEW.work_claim_expires_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.work_claim_expires_at IS DISTINCT FROM OLD.work_claim_expires_at) THEN
      INSERT INTO reception_work_signal_outbox(category, available_at) VALUES ('case', NEW.work_claim_expires_at);
    END IF;
    IF NEW.work_running_token IS NOT NULL AND NEW.work_running_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.work_running_token IS DISTINCT FROM OLD.work_running_token) THEN
      INSERT INTO reception_work_signal_outbox(category, available_at) VALUES ('case', NEW.work_running_at + interval '5 minutes');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER reception_work_signal_reception_cases AFTER INSERT OR UPDATE ON reception_cases FOR EACH ROW EXECUTE FUNCTION reception_work_signal();
CREATE TRIGGER reception_work_signal_admissions AFTER INSERT OR UPDATE ON admissions FOR EACH ROW EXECUTE FUNCTION reception_work_signal();
