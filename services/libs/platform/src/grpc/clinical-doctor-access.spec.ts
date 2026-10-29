import { ForbiddenException } from '@nestjs/common';
import { ClinicalDoctorAccess } from './clinical-doctor-access';

describe('clinical doctor access', () => {
  const unary = jest.fn();
  const grpc = { client: jest.fn((value) => value.key), metadata: jest.fn(), unary };
  const access = new ClinicalDoctorAccess({ get: jest.fn() } as any, grpc as any);
  const doctor = { userId: 'account-id', role: 'DOCTOR' } as any;
  beforeEach(() => { jest.resetAllMocks(); grpc.client.mockImplementation((value) => value.key); });

  it('resolves account to doctor and validates the encounter assignment', async () => {
    unary.mockResolvedValueOnce({ found: true, doctorId: 'doctor-id' }).mockResolvedValueOnce({ allowed: true, encounter: { patientId: 'patient-id' } });
    await access.assertEncounter(doctor, 'encounter-id', 'patient-id');
    expect(unary.mock.calls[1][2]).toEqual(expect.objectContaining({ encounterId: 'encounter-id', doctorId: 'doctor-id' }));
    expect(unary.mock.calls[1][2]).not.toHaveProperty('patientId');
  });

  it('rejects an encounter belonging to another patient', async () => {
    unary.mockResolvedValueOnce({ found: true, doctorId: 'doctor-id' }).mockResolvedValueOnce({ allowed: true, encounter: { patientId: 'other-patient' } });
    await expect(access.assertEncounter(doctor, 'encounter-id', 'patient-id')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
