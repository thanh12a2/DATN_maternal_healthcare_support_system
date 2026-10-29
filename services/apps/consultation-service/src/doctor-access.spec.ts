import { ForbiddenException } from '@nestjs/common';
import { ConsultationService } from './consultation.service';

describe('consultation doctor access', () => {
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const findAssignment = jest.fn();
  const createMany = jest.fn();
  const updateMany = jest.fn();
  const service = new ConsultationService({ consultationThread: { findUnique, findMany }, consultationAssignment: { findFirst: findAssignment }, consultationReadReceipt: { createMany, updateMany } } as any);
  const doctor = { role: 'DOCTOR', userId: 'account-id' } as any;
  beforeEach(() => jest.resetAllMocks());

  it('lists only threads assigned to the mapped doctor profile', async () => {
    findMany.mockResolvedValue([]);
    await service.list({}, doctor, { doctorId: jest.fn().mockResolvedValue('doctor-id') } as any);
    expect(findMany.mock.calls[0][0].where.assignedDoctorId).toBe('doctor-id');
  });

  it('rejects access to a thread assigned to another doctor', async () => {
    findUnique.mockResolvedValue({ assignedDoctorId: 'other-account' });
    await expect(service.authorizeParticipant('thread', doctor, { doctorId: jest.fn().mockResolvedValue('doctor-id') } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an active assignment for a non-closed thread', async () => {
    findUnique.mockResolvedValue({ assignedDoctorId: 'doctor-id', status: 'ASSIGNED' });
    findAssignment.mockResolvedValue(null);
    const access = { doctorId: jest.fn().mockResolvedValue('doctor-id') } as any;
    await expect(service.authorizeParticipant('thread', doctor, access)).rejects.toBeInstanceOf(ForbiddenException);
    findAssignment.mockResolvedValue({ doctorId: 'doctor-id' });
    await expect(service.authorizeParticipant('thread', doctor, access)).resolves.toBeUndefined();
  });

  it('advances a read receipt without allowing a sequence beyond the thread', async () => {
    findUnique.mockResolvedValue({ lastSequenceNo: 10n });
    await expect(service.markRead('thread', 'account-id', 11)).rejects.toThrow('INVALID_SEQUENCE');
    expect(createMany).not.toHaveBeenCalled();
    await service.markRead('thread', 'account-id', 4);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lastReadSequence: { lt: 4n } }) }));
  });
});
