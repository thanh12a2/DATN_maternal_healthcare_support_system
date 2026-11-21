import { NotificationService } from './notification.service';

describe('notification event ingestion', () => {
  const upsert = jest.fn();
  const service = new NotificationService({ notificationPendingEvent: { upsert } } as any, {} as any, {} as any, {} as any);
  beforeEach(() => upsert.mockReset());
  it('stores the event before acknowledging it to the consumer', async () => {
    const event = { eventId: '10000000-0000-4000-8000-000000000001', eventType: 'appointment.booked.v1', eventVersion: 1, aggregateType: 'appointment', aggregateId: '20000000-0000-4000-8000-000000000001', occurredAt: new Date().toISOString(), correlationId: 'request', producer: 'appointment-service', data: { patientId: '30000000-0000-4000-8000-000000000001' } };
    await service.consume(event);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: event.eventId }, create: expect.objectContaining({ status: 'PENDING', payload: event }) }));
  });
  it('records unsupported events without their potentially sensitive data', async () => {
    await service.consume({ eventId: '10000000-0000-4000-8000-000000000001', eventType: 'billing.unknown.v1', eventVersion: 1, aggregateType: 'invoice', aggregateId: '', occurredAt: '', correlationId: '', producer: '', data: { secret: 'private' } });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: 'UNSUPPORTED', payload: { eventType: 'billing.unknown.v1', eventVersion: 1 } }) }));
  });
});

describe('notification delivery', () => {
  const patientId = '30000000-0000-4000-8000-000000000001';
  const doctorId = '40000000-0000-4000-8000-000000000001';
  const eventId = '10000000-0000-4000-8000-000000000001';
  const aggregateId = '20000000-0000-4000-8000-000000000001';
  const upsert = jest.fn();
  const updateMany = jest.fn();
  const findMany = jest.fn();
  const unary = jest.fn();
  const db = { notificationPendingEvent: { findMany, updateMany }, $transaction: async (fn: any) => fn({ notification: { upsert }, notificationPendingEvent: { updateMany } }) };
  const service = new NotificationService(db as any, {} as any, { get: () => undefined } as any, { client: () => ({}), metadata: () => ({}), unary } as any);
  beforeEach(() => { jest.clearAllMocks(); unary.mockImplementation(async (_client, _method, request) => ({ found: true, accountId: request.patientId ? patientId : doctorId })); });
  it('delivers a booking to the linked patient and assigned doctor with a stable deduplication key', async () => {
    findMany.mockResolvedValue([{ eventId, eventType: 'appointment.booked.v1', attempts: 0, payload: { aggregateId, data: { patientId, doctorId } } }]);
    await service.flush();
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { sourceEventId_recipientAccountId_templateCode: { sourceEventId: eventId, recipientAccountId: doctorId, templateCode: 'appointment_booked_v1' } } }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DELIVERED', lastError: null } }));
  });
  it('does not deliver an expired queue call', async () => {
    findMany.mockResolvedValue([{ eventId, eventType: 'queue.ticket_called.v1', attempts: 0, payload: { aggregateId, data: { patientId, expiresAt: '2020-01-01T00:00:00.000Z' } } }]);
    await service.flush();
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SUPPRESSED', lastError: 'CALL_EXPIRED' } }));
  });
  it('delivers a new queue ticket to the linked patient', async () => {
    findMany.mockResolvedValue([{ eventId, eventType: 'queue.ticket_created.v1', attempts: 0, payload: { aggregateId, data: { patientId } } }]);
    await service.flush();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ recipientAccountId: patientId, resourceType: 'queue', title: 'Đã check-in và tạo lượt chờ' }) }));
  });
  it('retries without committing notifications when a recipient service is unavailable', async () => {
    findMany.mockResolvedValue([{ eventId, eventType: 'billing.payment_recorded.v1', attempts: 0, payload: { aggregateId, data: { patientId } } }]);
    unary.mockRejectedValue(new Error('unavailable'));
    await service.flush();
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempts: 1, lastError: 'PROCESSING_FAILED' }) }));
  });
});
