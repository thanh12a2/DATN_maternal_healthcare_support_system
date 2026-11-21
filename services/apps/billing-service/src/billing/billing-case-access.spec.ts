import { BillingController } from './billing.controller';

describe('billing case access', () => {
  it('runs transfer verification under the appointment case lock', async () => {
    const decideTransfer = jest.fn().mockResolvedValue({ status: 'PAID' });
    const db = { payment: { findUnique: jest.fn().mockResolvedValue({ invoiceId: 'invoice' }) }, invoice: { findUnique: jest.fn().mockResolvedValue({ appointmentId: 'appointment' }) } };
    const work = { run: jest.fn(async (_appointment, _account, action) => action()) };
    const controller = new BillingController({ decideTransfer } as any, {} as any, db as any, work as any);
    const actor = { userId: 'owner', role: 'RECEPTIONIST' } as any;
    await controller.verify('payment', { expectedInvoiceVersion: 1 } as any, actor);
    expect(work.run).toHaveBeenCalledWith('appointment', 'owner', expect.any(Function));
    expect(decideTransfer).toHaveBeenCalledTimes(1);
  });
  it('does not settle a payment when the case lock is denied', async () => {
    const decideTransfer = jest.fn();
    const db = { payment: { findUnique: jest.fn().mockResolvedValue({ invoiceId: 'invoice' }) }, invoice: { findUnique: jest.fn().mockResolvedValue({ appointmentId: 'appointment' }) } };
    const work = { run: jest.fn().mockRejectedValue(new Error('owned by another receptionist')) };
    const controller = new BillingController({ decideTransfer } as any, {} as any, db as any, work as any);
    await expect(controller.verify('payment', { expectedInvoiceVersion: 1 } as any, { userId: 'other' } as any)).rejects.toThrow('owned by another receptionist');
    expect(decideTransfer).not.toHaveBeenCalled();
  });
});
