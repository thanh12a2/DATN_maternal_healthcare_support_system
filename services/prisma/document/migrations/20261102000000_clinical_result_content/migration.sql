-- Existing metadata-only documents remain unchanged; new clinical files store their actual bytes.
ALTER TABLE "document_versions" ADD COLUMN "content" BYTEA;
