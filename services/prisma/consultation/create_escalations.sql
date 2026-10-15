DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscalationStatus') THEN
    CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS consultation_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES consultation_threads(id) ON DELETE CASCADE,
  reason_code VARCHAR(50) NOT NULL,
  detail VARCHAR(500),
  status "EscalationStatus" NOT NULL DEFAULT 'OPEN',
  raised_by_account_id UUID NOT NULL,
  raised_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  acknowledged_by_account_id UUID,
  acknowledged_at TIMESTAMPTZ(6),
  resolved_by_account_id UUID,
  resolved_at TIMESTAMPTZ(6),
  resolution_note VARCHAR(500),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_thread_id ON consultation_escalations(thread_id, raised_at);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON consultation_escalations(status, raised_at);
