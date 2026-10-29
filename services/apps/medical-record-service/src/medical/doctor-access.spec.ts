import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MedicalDomainService } from './medical.service';

describe('doctor encounter assignment', () => {
  const findFirst = jest.fn();
  const resolve = jest.fn();
  const db = { encounterAssignment: { findFirst } } as any;
  const service = new MedicalDomainService(db, { resolve } as any);
  beforeEach(() => { jest.resetAllMocks(); resolve.mockResolvedValue('doctor-id'); });

  it('checks the mapped doctor profile and active assignment', async () => {
    findFirst.mockResolvedValue({ staffId: 'doctor-id' });
    await service.assertDoctorAssigned('encounter-id', 'account-id');
    expect(resolve).toHaveBeenCalledWith('account-id');
    expect(findFirst).toHaveBeenCalledWith({ where: { encounterId: 'encounter-id', staffId: 'doctor-id', status: 'ACTIVE' } });
  });

  it('rejects an unassigned doctor without creating an assignment', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.assertDoctorAssigned('encounter-id', 'account-id')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a version before writing a doctor note', async () => {
    await expect(service.addNote('encounter-id', { content: 'Ghi chú' }, 'account-id', 'DOCTOR')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not start an encounter when the appointment has not checked in', async () => {
    const transaction = jest.fn();
    const checkedIn = jest.fn().mockResolvedValue(false);
    findFirst.mockResolvedValue({ staffId: 'doctor-id' });
    const guarded = new MedicalDomainService({ encounterAssignment: { findFirst }, clinicalEncounter: { findUnique: jest.fn().mockResolvedValue({ appointmentId: 'appointment-id', state: 'DRAFT' }) }, $transaction: transaction } as any, { resolve, checkedIn } as any);
    await expect(guarded.start('encounter-id', 1, 'account-id', 'DOCTOR')).rejects.toThrow('APPOINTMENT_NOT_CHECKED_IN');
    expect(checkedIn).toHaveBeenCalledWith('appointment-id', 'encounter-id', 'doctor-id');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('writes a note only after an atomic assignment, state and version check', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({ id: 'note-id' });
    const transactional = new MedicalDomainService({ $transaction: (fn: any) => fn({ clinicalEncounter: { updateMany }, clinicalNote: { create } }) } as any, { resolve } as any);
    await transactional.addNote('encounter-id', { content: 'Khám', expectedVersion: 2 }, 'account-id', 'DOCTOR');
    expect(updateMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ version: 2, state: 'IN_PROGRESS', assignments: { some: { staffId: 'doctor-id', status: 'ACTIVE' } } }));
    expect(create).toHaveBeenCalledTimes(1);
    updateMany.mockResolvedValue({ count: 0 });
    await expect(transactional.addNote('encounter-id', { content: 'Khám', expectedVersion: 2 }, 'account-id', 'DOCTOR')).rejects.toBeInstanceOf(ConflictException);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
