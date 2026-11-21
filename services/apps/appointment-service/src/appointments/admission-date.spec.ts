import { AppointmentDomainService } from './appointment.service';

describe('Admission date in hospital timezone', () => {
  afterEach(() => jest.useRealTimers());
  it('rejects future-day reception before invoicing and allows the visit on its local date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-14T16:59:00Z'));
    const visit = { id: 'visit', patientId: 'patient', status: 'BOOKED', startAt: new Date('2026-11-15T00:30:00+07:00') };
    const service = new AppointmentDomainService({ appointment: { findUnique: jest.fn().mockResolvedValue(visit) } } as any, {} as any, {} as any);
    await expect(service.validateAdmission('code', 'patient')).resolves.toEqual({ valid: false, failureCode: 'APPOINTMENT_NOT_DUE' });
    await expect(service.checkIn('code', { paymentCondition: 'PAID' })).rejects.toThrow();
    jest.setSystemTime(new Date('2026-11-14T17:01:00Z'));
    await expect(service.validateAdmission('code', 'patient')).resolves.toEqual(expect.objectContaining({ valid: true }));
  });
});
