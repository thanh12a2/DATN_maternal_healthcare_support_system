import { presentPatient, presentSearchPatient } from './patient-presenter';
import type { NationalIdCryptoService } from '../security/national-id-crypto.service';

describe('patient account linkage in staff responses', () => {
  const crypto = {
    maskCiphertext: () => null,
    decrypt: () => null,
  } as unknown as NationalIdCryptoService;
  const patient = {
    id: 'patient-id',
    authAccountId: 'account-id',
    fullName: 'Test Patient',
    dateOfBirth: new Date('1995-01-01T00:00:00.000Z'),
    phoneNumber: '+84901234567',
    nationalIdCiphertext: null,
    address: null,
    version: 1,
    emergencyContacts: [],
  };

  it('includes the linked account ID in search and detail responses', () => {
    expect(presentSearchPatient(patient, crypto).authAccountId).toBe('account-id');
    expect(presentPatient(patient as never, crypto).authAccountId).toBe('account-id');
  });
});
