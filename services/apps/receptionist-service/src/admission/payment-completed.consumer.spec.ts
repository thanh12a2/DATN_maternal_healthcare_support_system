import { PaymentCompletedConsumer } from './payment-completed.consumer';

describe('paid reception case', () => {
  const ids = { appointmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoiceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
  const event = { eventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', eventType: 'billing.payment_recorded.v1', eventVersion: 1, data: { ...ids, status: 'PAID' } } as any;
  const findFirst = jest.fn();
  const admit = jest.fn();
  const consumer = new PaymentCompletedConsumer({ receptionCase: { findFirst } } as any, {} as any, {} as any, { admit } as any);
  beforeEach(() => { findFirst.mockReset(); admit.mockReset(); });
  it('continues the matching case as its owner', async () => {
    findFirst.mockResolvedValue({ id: 'case', workClaimedBy: 'owner', workRunningToken: null, admission: { invoiceId: ids.invoiceId, status: 'AWAITING_PAYMENT' } });
    await consumer.consume(event);
    expect(admit).toHaveBeenCalledWith('case', expect.objectContaining({ userId: 'owner', role: 'RECEPTIONIST' }));
  });
  it('retries when another operation still holds the case', async () => {
    findFirst.mockResolvedValue({ workClaimedBy: 'owner', workRunningToken: 'busy', admission: { invoiceId: ids.invoiceId, status: 'AWAITING_PAYMENT' } });
    await expect(consumer.consume(event)).rejects.toThrow('CASE_OPERATION_IN_PROGRESS');
    expect(admit).not.toHaveBeenCalled();
  });
  it('ignores a different invoice and malformed events', async () => {
    findFirst.mockResolvedValue({ workClaimedBy: 'owner', admission: { invoiceId: 'different', status: 'AWAITING_PAYMENT' } });
    await consumer.consume(event);
    await consumer.consume({ ...event, data: { ...event.data, patientId: 'bad' } });
    expect(admit).not.toHaveBeenCalled();
  });
});
