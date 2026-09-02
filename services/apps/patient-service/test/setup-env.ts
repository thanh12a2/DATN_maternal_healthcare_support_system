import { generateKeyPairSync } from 'crypto';
const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
Object.assign(process.env, {
  AUTH_JWT_PUBLIC_KEY: keys.publicKey,
  AUTH_JWT_KEY_ID: 'test-key',
  JWT_ISSUER: 'maternal-healthcare-auth',
  JWT_AUDIENCE: 'maternal-healthcare-api',
  AUTH_JWT_ISSUER: 'maternal-healthcare-auth',
  AUTH_JWT_AUDIENCE: 'maternal-healthcare-api',
  PATIENT_NATIONAL_ID_ENCRYPTION_KEY: '11'.repeat(32),
  PATIENT_NATIONAL_ID_LOOKUP_PEPPER: 'a-strong-test-pepper-value',
  PATIENT_INTERNAL_JWT_PUBLIC_KEY: keys.publicKey,
  PATIENT_INTERNAL_JWT_KEY_ID: 'test-key',
  PATIENT_INTERNAL_JWT_ISSUER: 'maternal-healthcare-internal',
  PATIENT_INTERNAL_JWT_AUDIENCE: 'patient-service',
});
(globalThis as any).__E2E_PRIVATE_KEY__ = keys.privateKey;
