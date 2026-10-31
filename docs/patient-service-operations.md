# Patient Service Operations Runbook

## Readiness and health

- `GET /health`: process liveness only; never calls dependencies.
- `GET /ready`: executes `SELECT 1` against Patient PostgreSQL and returns 503 when unavailable.
- Alert on sustained readiness failure, 5xx rate, and latency. Metrics/log labels must never contain Patient IDs, JWTs, national IDs, phone numbers, names, addresses, or payloads.

## Key rotation

### End-user access JWT

1. Publish both old and new public keys in Auth JWKS.
2. Switch Auth signing to the new `kid`.
3. Patient accepts the configured static current key and refreshes JWKS for unknown `kid` (default cache 300 seconds).
4. Keep the old key published for at least maximum access-token TTL plus JWKS cache TTL.
5. Remove the old key and update the static key/id in the next deployment.

### National ID encryption/HMAC

Ciphertext is versioned `v1`. Rotation requiring data re-encryption must be a reviewed, resumable migration: add new key version, dual-read, batch rewrite, verify, then retire the old key. Changing the HMAC pepper requires recomputing lookup hashes under an exclusive migration window because uniqueness depends on it. Never log plaintext during migration.

## Retention

- Patient and audit records are not automatically deleted until legal retention/deletion is approved.
- Receptionist idempotency records expire logically after 24 hours; cleanup may delete only expired records in bounded batches.
- Access to audit tables is restricted to operational/legal roles and is not exposed by Patient APIs.

## Backup and restore

- PostgreSQL target: encrypted daily base backup plus WAL archiving/PITR; suggested initial RPO 15 minutes and RTO 4 hours pending stakeholder approval.
- Test restore quarterly into an isolated environment, run migrations, integrity checks, and smoke tests.
- Backups and restore logs must not expose decrypted national IDs. Crypto keys are backed up separately in a secrets manager; database backup alone must not contain keys.

## Failure behavior

- Patient DB outage: data APIs return 503, liveness remains 200, readiness returns 503.
- Auth outage: already-issued access JWTs remain verifiable using static/JWKS-cached keys.
- JWKS outage: configured current static key remains available; unknown keys fail closed.
- Audit failure: sensitive mutation transaction rolls back.
