import { AdmissionService } from './admission.service';

describe('queueing a walk-in arrival', () => {
  it('assigns the walk-in case to the receptionist recording arrival', async () => {
    const db = { receptionCase: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...data })) }, receptionAuditLog: { create: jest.fn() }, receptionAppointmentOperation: { findUnique: jest.fn().mockResolvedValue(null) }, $queryRaw: jest.fn(), $transaction: jest.fn() };
    db.$transaction.mockImplementation(async (fn: any) => fn(db));
    const remote = {
      validateAppointment: jest.fn().mockResolvedValue({ valid: true, startAt: { seconds: '1800000000' } }),
      patientIdentity: jest.fn().mockResolvedValue({ patient: { fullName: 'Patient' } }),
      getAppointment: jest.fn().mockResolvedValue({ appointment: { channel: 'BOOKING_CHANNEL_WALK_IN' } }),
    };
    const work = { claim: jest.fn() };
    const service = new AdmissionService(db as any, remote as any, work as any);
    await service.openCase({ appointmentId: 'appointment', patientId: 'patient' }, { userId: 'staff' } as any);
    expect(db.receptionCase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'WALK_IN', workClaimedBy: 'staff' }) }));
    expect(db.receptionAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: 'staff', eventType: 'reception.work_claimed.v1' }) }));
    expect(work.claim).not.toHaveBeenCalled();
  });
});
