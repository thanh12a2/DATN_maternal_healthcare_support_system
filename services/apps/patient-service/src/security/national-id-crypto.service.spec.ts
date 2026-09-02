import { describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { NationalIdCryptoService } from './national-id-crypto.service';
describe('NationalIdCryptoService', () => {
  const values = {
    PATIENT_NATIONAL_ID_ENCRYPTION_KEY: '11'.repeat(32),
    PATIENT_NATIONAL_ID_LOOKUP_PEPPER: 'a-strong-test-pepper-value',
  };
  const service = new NationalIdCryptoService({
    get: (k: string) => (values as any)[k],
  } as ConfigService);
  it('encrypts with randomized AES-GCM and masks', () => {
    const a = service.encrypt('012345678901'),
      b = service.encrypt('012345678901');
    expect(a).not.toBe(b);
    expect(a).not.toContain('012345678901');
    expect(service.decrypt(a)).toBe('012345678901');
    expect(service.maskCiphertext(a)).toBe('********8901');
  });
  it('uses deterministic keyed lookup hash', () => {
    expect(service.lookupHash('012345678901')).toBe(
      service.lookupHash('012345678901'),
    );
    expect(service.lookupHash('012345678901')).toHaveLength(64);
  });
});
