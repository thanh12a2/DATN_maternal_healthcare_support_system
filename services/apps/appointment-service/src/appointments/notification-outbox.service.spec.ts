import { NotificationOutboxService } from './notification-outbox.service';

describe('appointment notification relay', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const row = { id, event_type: 'appointment.booked.v1', payload: { aggregateId: id, aggregateType: 'appointment', data: { patientId: id } }, occurred_at: new Date('2026-11-03T00:00:00Z') };
  it('publishes the stable outbox id and marks it published only after confirmation', async () => {
    const query = jest.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    const update = jest.fn();
    const tx = { $queryRaw: query, $executeRaw: update };
    const db = { $transaction: jest.fn().mockImplementation(fn => fn(tx)) };
    const publisher = { ensureBindings: jest.fn(), publish: jest.fn() };
    await new NotificationOutboxService(db as any, publisher as any).flush();
    expect(publisher.publish).toHaveBeenCalledWith(row.event_type, expect.objectContaining({ eventId: id, data: { patientId: id } }));
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('does not mark the event published when RabbitMQ fails', async () => {
    const update = jest.fn();
    const tx = { $queryRaw: jest.fn().mockResolvedValue([row]), $executeRaw: update };
    const db = { $transaction: jest.fn().mockImplementation(fn => fn(tx)) };
    const publisher = { ensureBindings: jest.fn(), publish: jest.fn().mockRejectedValue(new Error('broker down')) };
    await new NotificationOutboxService(db as any, publisher as any).flush();
    expect(update).not.toHaveBeenCalled();
  });
});
