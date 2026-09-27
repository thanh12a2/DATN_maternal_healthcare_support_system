CREATE TABLE "password_reset_tokens" (
  "account_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("account_id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
  ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_expires_at_idx"
  ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
