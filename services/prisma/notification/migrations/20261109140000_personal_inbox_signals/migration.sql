CREATE TABLE personal_inbox_signal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_account_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX personal_inbox_signal_due_idx ON personal_inbox_signal_outbox (occurred_at, id);

CREATE FUNCTION personal_inbox_signal() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    INSERT INTO personal_inbox_signal_outbox(recipient_account_id) VALUES (NEW.recipient_account_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER personal_inbox_signal_changed AFTER INSERT OR UPDATE OF read_at ON notifications
FOR EACH ROW EXECUTE FUNCTION personal_inbox_signal();
