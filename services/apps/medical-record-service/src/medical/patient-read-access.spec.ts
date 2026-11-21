import { MedicalDomainService } from './medical.service';

describe('Patient clinical record ownership', () => {
  const auth = { userId: 'account-a', role: 'PATIENT' } as any;
  const fixture = () => {
    const db = { clinicalEncounter: { findUnique: jest.fn().mockResolvedValue({ id: 'visit', patientId: 'patient-a' }) } };
    const identity = { patientForAccount: jest.fn().mockResolvedValue('patient-a') };
    return { db, identity, service: new MedicalDomainService(db as any, identity as any) };
  };
  it('allows the owner but denies a different patient even with a valid session', async () => {
    const { service, identity } = fixture();
    await expect(service.assertReadAccess('visit', auth)).resolves.toBeUndefined();
    identity.patientForAccount.mockResolvedValue('patient-b');
    await expect(service.assertReadAccess('visit', auth)).rejects.toThrow('PATIENT_MISMATCH');
  });
  it('scopes listing to the authenticated patient and rejects a forged filter', async () => {
    const { service } = fixture();
    await expect(service.scopeReadQuery({ limit: 5 }, auth)).resolves.toEqual({ patientId: 'patient-a', limit: 5 });
    await expect(service.scopeReadQuery({ patientId: 'patient-b' }, auth)).rejects.toThrow('PATIENT_MISMATCH');
  });
  it('fails closed when identity resolution fails', async () => {
    const { service, identity } = fixture();
    identity.patientForAccount.mockRejectedValue(new Error('unavailable'));
    await expect(service.scopeReadQuery({}, auth)).rejects.toThrow('unavailable');
  });
});
