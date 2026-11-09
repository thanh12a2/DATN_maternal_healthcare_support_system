ALTER TABLE accounts ADD COLUMN email_verified_at TIMESTAMPTZ(6), ADD COLUMN verified_email VARCHAR(255);
CREATE TABLE email_verification_tokens (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX email_verification_tokens_expires_at_idx ON email_verification_tokens(expires_at);
