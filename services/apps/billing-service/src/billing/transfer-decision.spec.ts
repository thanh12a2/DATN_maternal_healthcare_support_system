import { BillingDomainService } from './billing.service';

describe('transfer decision', () => {
  it('does not update the invoice when the payment changed concurrently', async () => {
    const invoice = { id: 'invoice', version: 2, status: 'PAYMENT_PENDING_VERIFICATION', totalMinor: 100n };
    const tx = { $queryRaw: jest.fn(), payment: { findUnique: jest.fn().mockResolvedValue({ invoiceId: 'invoice', invoice, method: 'MANUAL_BANK_TRANSFER', status: 'RECORDED' }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) }, invoice: { update: jest.fn() } };
    const billing = new BillingDomainService({ $transaction: (fn: any) => fn(tx) } as any, {} as any);
    await expect(billing.decideTransfer('payment', true, { expectedInvoiceVersion: 2 }, { userId: 'owner', role: 'RECEPTIONIST' } as any)).rejects.toThrow('Giao dịch đã được xử lý');
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
  it('marks the invoice paid and emits a payment event', async () => {
    const invoice = { id: 'invoice', version: 2, status: 'PAYMENT_PENDING_VERIFICATION', totalMinor: 100n };
    const tx = { $queryRaw: jest.fn(), payment: { findUnique: jest.fn().mockResolvedValue({ invoiceId: 'invoice', invoice, method: 'MANUAL_BANK_TRANSFER', status: 'RECORDED' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, invoice: { update: jest.fn().mockResolvedValue({ ...invoice, status: 'PAID', paidMinor: 100n, balanceMinor: 0n, subtotalMinor: 100n, sourceVersion: 1n }) }, billingAuditLog: { create: jest.fn() }, billingOutboxEvent: { create: jest.fn() } };
    const billing = new BillingDomainService({ $transaction: (fn: any) => fn(tx) } as any, {} as any);
    await billing.decideTransfer('payment', true, { expectedInvoiceVersion: 2 }, { userId: 'owner', role: 'RECEPTIONIST' } as any);
    expect(tx.billingOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'billing.payment_recorded.v1' }) }));
  });
});
