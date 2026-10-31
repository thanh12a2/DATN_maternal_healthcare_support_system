import { describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { InternalJwtVerifierService } from './internal-jwt-verifier.service';

const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const service = new InternalJwtVerifierService({
  get: (key: string) => ({
    PATIENT_INTERNAL_JWT_PUBLIC_KEY: keys.publicKey,
    PATIENT_INTERNAL_JWT_KEY_ID: 'internal-key',
    PATIENT_INTERNAL_JWT_ISSUER: 'maternal-healthcare-internal',
    PATIENT_INTERNAL_JWT_AUDIENCE: 'patient-service',
  } as Record<string, string>)[key],
} as ConfigService);
const token = (scope: string, subject = 'appointment-service') => sign(
  { scope }, keys.privateKey,
  {
    algorithm: 'RS256', issuer: 'maternal-healthcare-internal', audience: 'patient-service',
    subject, jwtid: randomUUID(), keyid: 'internal-key', expiresIn: '5m',
  },
);

describe('InternalJwtVerifierService', () => {
  it('accepts allowed service identity and scope', () => {
    expect(service.verify(token('patient:eligibility:read'))).toEqual(expect.objectContaining({
      serviceId: 'appointment-service', scopes: ['patient:eligibility:read'],
    }));
  });
  it('rejects missing scope and unknown service identity', () => {
    expect(() => service.verify(token('other'))).toThrow();
    expect(() => service.verify(token('patient:eligibility:read', 'unknown-service'))).toThrow();
  });
});
