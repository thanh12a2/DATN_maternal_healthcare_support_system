CREATE TABLE "consultation_read_receipts" (
  "thread_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "last_read_sequence" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultation_read_receipts_pkey" PRIMARY KEY ("thread_id", "account_id"),
  CONSTRAINT "consultation_read_receipts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "consultation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
