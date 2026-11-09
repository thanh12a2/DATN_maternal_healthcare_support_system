import { describe, expect, it, vi } from 'vitest';
import { recordPendingTransfer } from './receptionDesk';

describe('reception transfer payment', () => {
  it('records a bank transfer for review without checking in', async () => {
    const request = vi.fn(async (_path: string, _options: RequestInit) => ({}));
    const appointment = { id: 'appointment', invoice: { id: 'invoice', balance: 100000, total: 100000, version: 3 } };
    await recordPendingTransfer(request as never, appointment as never, ' BANK-123 ');
    expect(request).toHaveBeenCalledTimes(1);
    const [path, options] = request.mock.calls[0];
    expect(path).toBe('/api/billing/invoices/invoice/payments');
    expect(JSON.parse(options.body as string)).toMatchObject({ method: 'MANUAL_BANK_TRANSFER', amountMinor: 100000, manualTransferReference: 'BANK-123', expectedInvoiceVersion: 3 });
  });
});
