import { AppointmentDomainService } from './appointment.service';

describe('appointment doctor scope', () => {
  const findMany = jest.fn();
  const doctorByAccount = jest.fn();
  const patientIdentity = jest.fn();
  const findHolds = jest.fn();
  const service = new AppointmentDomainService({ appointment: { findMany }, slotHold: { findMany: findHolds } } as any, { doctorByAccount, patientIdentity } as any);
  const doctor = { role: 'DOCTOR', userId: 'account-id' } as any;
  beforeEach(() => { jest.resetAllMocks(); doctorByAccount.mockResolvedValue({ found: true, doctorId: 'doctor-id' }); findMany.mockResolvedValue([]); });

  it('forces the mapped doctor on the list query', async () => {
    await service.list({}, doctor);
    expect(findMany.mock.calls[0][0].where.assignedDoctorId).toBe('doctor-id');
  });

  it('rejects a different requested doctor', async () => {
    await expect(service.list({ doctorId: 'other-doctor' }, doctor)).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('loads only the minimal patient name for rows already scoped to the doctor', async () => {
    findMany.mockResolvedValue([{ id: 'appointment', patientId: 'patient', availabilityVersion: 1, baseAmountMinor: 0, rankSurchargeAmountMinor: 0, estimatedTotalMinor: 0 }]);
    patientIdentity.mockResolvedValue({ patient: { fullName: 'Bệnh nhân A', nationalIdLast4: '1234' } });
    const result = await service.list({}, doctor);
    expect(patientIdentity).toHaveBeenCalledWith('patient', expect.objectContaining({ actorAccountId: 'account-id' }));
    expect(result.items[0]).toEqual(expect.objectContaining({ patientName: 'Bệnh nhân A' }));
    expect(result.items[0]).not.toHaveProperty('nationalIdLast4');
  });

  it('limits occupancy to the mapped doctor and exposes only interval times', async () => {
    const times = { startAt: new Date('2026-01-01T01:00:00Z'), endAt: new Date('2026-01-01T02:00:00Z') };
    findMany.mockResolvedValue([times]); findHolds.mockResolvedValue([]);
    const result = await service.doctorOccupancy({ from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' }, doctor);
    expect(findMany.mock.calls[0][0].where.assignedDoctorId).toBe('doctor-id');
    expect(findHolds.mock.calls[0][0].where.doctorId).toBe('doctor-id');
    expect(result.data).toEqual([times]);
  });
});
