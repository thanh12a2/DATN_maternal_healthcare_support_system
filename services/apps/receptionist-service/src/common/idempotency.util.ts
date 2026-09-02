import { createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateIdempotencyKey(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new DomainException(
      'VALIDATION_FAILED',
      'Idempotency-Key must be a UUID',
      HttpStatus.BAD_REQUEST,
    );
  }
  return value;
}

export function hashRequest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function assertMatchingRequestHash(
  actual: string,
  expected: string,
): void {
  if (actual !== expected) {
    throw new DomainException(
      'IDEMPOTENCY_KEY_REUSED',
      'Idempotency-Key was already used with a different request',
      HttpStatus.CONFLICT,
    );
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
