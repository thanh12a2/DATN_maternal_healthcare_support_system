import { ForbiddenException } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';

describe('doctor prescription access', () => {
  it('requires encounter authorization before listing', async () => {
    const assertEncounter = jest.fn().mockRejectedValue(new ForbiddenException());
    const listRest = jest.fn();
    const controller = new PrescriptionController({ listRest } as any, { assertEncounter } as any);
    await expect(controller.listPrescriptions({ encounterId: 'other' }, { role: 'DOCTOR', userId: 'a' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(listRest).not.toHaveBeenCalled();
  });

  it('denies creation when the doctor is not assigned to the encounter', async () => {
    const createRest = jest.fn();
    const controller = new PrescriptionController({ createRest } as any, { assertEncounter: jest.fn().mockRejectedValue(new ForbiddenException()) } as any);
    await expect(controller.createPrescription({ encounterId: 'other', patientId: 'p', items: [{ medicationName: 'Thuốc', dose: '1 viên', frequency: '1 lần', route: 'Uống' }] }, { role: 'DOCTOR', userId: 'a' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createRest).not.toHaveBeenCalled();
  });

  it('creates a draft with the resolved doctor when assigned to an in-progress encounter', async () => {
    const createRest = jest.fn().mockResolvedValue({ data: {} });
    const access = { assertEncounter: jest.fn().mockResolvedValue({ state: 'ENCOUNTER_STATE_IN_PROGRESS', resolvedDoctorId: 'doctor-id' }) };
    const controller = new PrescriptionController({ createRest } as any, access as any);
    const body = { encounterId: 'e', patientId: 'p', items: [{ medicationName: 'Thuốc', dose: '1 viên', frequency: '1 lần', route: 'Uống' }] };
    const auth = { role: 'DOCTOR', userId: 'account-id' } as any;
    await controller.createPrescription(body, auth);
    expect(access.assertEncounter).toHaveBeenCalledWith(auth, 'e', 'p');
    expect(createRest).toHaveBeenCalledWith(body, auth, 'doctor-id');
  });

  it('allows an assigned doctor to cancel an issued prescription after finalization', async () => {
    const getRest = jest.fn().mockResolvedValue({ data: { encounterId: 'e', patientId: 'p', status: 'ISSUED' } });
    const cancelRest = jest.fn().mockResolvedValue({ data: {} });
    const access = { assertEncounter: jest.fn().mockResolvedValue({ state: 'ENCOUNTER_STATE_FINALIZED' }) };
    const controller = new PrescriptionController({ getRest, cancelRest } as any, access as any);
    await controller.cancelPrescription('rx', { version: 2, reason: 'Thay đổi điều trị' }, { role: 'DOCTOR', userId: 'a' } as any);
    expect(cancelRest).toHaveBeenCalledWith('rx', { version: 2, reason: 'Thay đổi điều trị' });
  });
});
