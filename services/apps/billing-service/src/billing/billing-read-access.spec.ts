import { BillingDomainService } from './billing.service';

describe('invoice access after merging patient and doctor invoice views', () => {
  const patient = { userId: 'account', role: 'PATIENT' } as any;

  it('forces the authenticated patient onto invoice list queries', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const access = { patientId: jest.fn().mockResolvedValue('own-patient') };
    const service = new BillingDomainService(
      { invoice: { findMany } } as any,
      {} as any,
      access as any,
    );
    await service.list({ appointmentId: 'appointment' }, patient);
    expect(findMany.mock.calls[0][0].where).toEqual({
      appointmentId: 'appointment',
      patientId: 'own-patient',
    });
  });

  it('rejects requesting another patient before querying their invoices', async () => {
    const findMany = jest.fn();
    const access = { patientId: jest.fn().mockResolvedValue('own-patient') };
    const service = new BillingDomainService(
      { invoice: { findMany } } as any,
      {} as any,
      access as any,
    );
    await expect(
      service.list({ patientId: 'other-patient' }, patient),
    ).rejects.toThrow('Invoice belongs to another patient');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects reading another patient invoice by id', async () => {
    const db = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ patientId: 'other-patient' }),
      },
    };
    const service = new BillingDomainService(
      db as any,
      {} as any,
      { patientId: jest.fn().mockResolvedValue('own-patient') } as any,
    );
    await expect(service.get('invoice', patient)).rejects.toThrow(
      'Invoice belongs to another patient',
    );
  });

  it('checks clinical assignment before returning invoices to a doctor', async () => {
    const invoice = {
      encounterId: 'encounter',
      appointmentId: 'appointment',
      patientId: 'patient',
    };
    const access = {
      assertDoctorInvoice: jest
        .fn()
        .mockRejectedValue(new Error('NOT_ASSIGNED')),
    };
    const service = new BillingDomainService(
      { invoice: { findMany: jest.fn().mockResolvedValue([invoice]) } } as any,
      {} as any,
      access as any,
    );
    await expect(
      service.list({ appointmentId: 'appointment' }, {
        userId: 'doctor',
        role: 'DOCTOR',
      } as any),
    ).rejects.toThrow('NOT_ASSIGNED');
    expect(access.assertDoctorInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'DOCTOR' }),
      invoice,
    );
  });
});
