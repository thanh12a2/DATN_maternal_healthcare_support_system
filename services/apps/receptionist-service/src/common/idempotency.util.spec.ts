import { DomainException } from './domain.exception';
import {
  assertMatchingRequestHash,
  hashRequest,
  validateIdempotencyKey,
} from './idempotency.util';

describe('idempotency utilities', () => {
  it('hashes equivalent objects independently of property order', () => {
    expect(hashRequest({ b: 2, a: 1 })).toBe(hashRequest({ a: 1, b: 2 }));
  });

  it('rejects malformed keys', () => {
    expect(() => validateIdempotencyKey('not-a-uuid')).toThrow(DomainException);
  });

  it('rejects reuse with a different payload hash', () => {
    expect(() => assertMatchingRequestHash('first', 'second')).toThrow(
      DomainException,
    );
  });
});
