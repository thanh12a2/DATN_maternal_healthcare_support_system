import { AppointmentSyncService } from './appointment-sync.service';
import { DoctorIdentityGateway } from './doctor-identity.gateway';

describe('appointment synchronization', () => {
  const job = {
    id: 'job',
    encounterId: 'encounter',
    appointmentId: 'appointment',
    encounterVersion: 2,
    action: 'START',
    attempts: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('leaves a failed job pending and records a retry', async () => {
    const updateMany = jest.fn();
    const db = {
      encounterAppointmentSync: {
        findMany: jest.fn().mockResolvedValue([job]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany,
      },
    };
    const service = new AppointmentSyncService(
      db as any,
      {
        reconcileAppointment: jest.fn().mockRejectedValue(new Error('timeout')),
      } as any,
    );
    await service.flush();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job', status: 'PENDING' },
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      }),
    );
  });

  it('does not process a later transition while an earlier one is pending', async () => {
    const reconcileAppointment = jest.fn();
    const db = {
      encounterAppointmentSync: {
        findMany: jest.fn().mockResolvedValue([job]),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'earlier', nextAttemptAt: new Date() }),
        updateMany: jest.fn(),
      },
    };
    await new AppointmentSyncService(
      db as any,
      { reconcileAppointment } as any,
    ).flush();
    expect(reconcileAppointment).not.toHaveBeenCalled();
    expect(db.encounterAppointmentSync.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job', status: 'PENDING' },
        data: { nextAttemptAt: expect.any(Date) },
      }),
    );
  });

  it('recognizes an already applied appointment after a lost response', async () => {
    const unary = jest.fn().mockResolvedValue({
      appointment: {
        encounterId: 'encounter',
        status: 'APPOINTMENT_STATUS_IN_CLINICAL_CARE',
      },
    });
    const gateway = new DoctorIdentityGateway(
      { get: jest.fn() } as any,
      { client: jest.fn(), metadata: jest.fn(), unary } as any,
    );
    await gateway.reconcileAppointment(job);
    expect(unary).toHaveBeenCalledTimes(2);
    expect(unary.mock.calls[1][1]).toBe('syncClinicalJourney');
    expect(unary.mock.calls[1][2]).toEqual(expect.objectContaining({ action: 'START' }));
  });

  it('refuses to update an appointment linked to a different encounter', async () => {
    const unary = jest.fn().mockResolvedValue({
      appointment: {
        encounterId: 'different',
        status: 'APPOINTMENT_STATUS_CHECKED_IN',
      },
    });
    const gateway = new DoctorIdentityGateway(
      { get: jest.fn() } as any,
      { client: jest.fn(), metadata: jest.fn(), unary } as any,
    );
    await expect(gateway.reconcileAppointment(job)).rejects.toThrow(
      'APPOINTMENT_ENCOUNTER_MISMATCH',
    );
    expect(unary).toHaveBeenCalledTimes(1);
  });

  it('retries queue synchronization even after the appointment has already completed', async () => {
    const unary = jest.fn().mockImplementation(async (_client, method) => {
      if (method === 'getAppointment') return { appointment: { encounterId: 'encounter', status: 'APPOINTMENT_STATUS_COMPLETED' } };
      if (method === 'syncClinicalJourney') throw new Error('QUEUE_UNAVAILABLE');
    });
    const gateway = new DoctorIdentityGateway({ get: jest.fn() } as any, { client: jest.fn(), metadata: jest.fn(), unary } as any);
    await expect(gateway.reconcileAppointment({ ...job, action: 'COMPLETE' })).rejects.toThrow('QUEUE_UNAVAILABLE');
    expect(unary.mock.calls.map(x=>x[1])).toEqual(['getAppointment', 'syncClinicalJourney']);
    unary.mockImplementation(async (_client, method) => method === 'getAppointment' ? { appointment: { encounterId: 'encounter', status: 'APPOINTMENT_STATUS_COMPLETED' } } : { synchronized: true });
    await expect(gateway.reconcileAppointment({ ...job, action: 'COMPLETE' })).resolves.toBeUndefined();
    expect(unary.mock.calls.some(x=>x[1]==='markClinicalCompleted')).toBe(false);
  });
});
