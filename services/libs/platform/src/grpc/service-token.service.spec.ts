import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { ServiceTokenService } from './service-token.service';

describe('ServiceTokenService', () => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const config = new ConfigService({
    INTERNAL_SERVICE_JWT_PRIVATE_KEY: keys.privateKey,
    INTERNAL_SERVICE_JWT_PUBLIC_KEY: keys.publicKey,
    INTERNAL_SERVICE_JWT_ISSUER: 'maternal-healthcare-internal',
    INTERNAL_SERVICE_JWT_AUDIENCE: 'patient-service',
    INTERNAL_SERVICE_JWT_KEY_ID: 'test-key',
  });
  const service = new ServiceTokenService(config);

  it('signs and verifies scoped service tokens', () => {
    const token = service.sign({ serviceId: 'appointment-service', audience: 'patient-service', scopes: ['patient:eligibility:read'] });
    expect(service.verify(token)).toMatchObject({ serviceId: 'appointment-service', scopes: ['patient:eligibility:read'] });
  });

  it('rejects a token for the wrong audience', () => {
    const token = service.sign({ serviceId: 'appointment-service', audience: 'doctor-service', scopes: ['doctor:read'] });
    expect(() => service.verify(token)).toThrow('Invalid internal service token');
  });
});
