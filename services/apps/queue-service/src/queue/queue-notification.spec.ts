import { QueueDomainService } from './queue.service';

describe('queue notification event', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const ticket = { id: 'ticket-id', journeyId: 'journey-id', version: 1, createdAt: now, stage: { code: 'CONSULTATION' } };
  const journey = { id: 'journey-id', patientId: 'patient-id', appointmentId: 'appointment-id', encounterId: 'encounter-id', version: 1, businessDate: now, tickets: [ticket] };
  const outbox = jest.fn();
  const tx = { stageTicket: { aggregate: jest.fn().mockResolvedValue({ _max: {} }), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) }, queueJourney: { create: jest.fn().mockResolvedValue(journey) }, queueOutbox: { create: outbox } };
  const db = { queueJourney: { findUnique: jest.fn() }, queueStage: { upsert: jest.fn().mockResolvedValue({ id: 'stage-id', code: 'CONSULTATION' }) }, $transaction: jest.fn(async (fn) => fn(tx)) };
  const service = new QueueDomainService(db as any, {} as any);
  const input = { appointmentId: 'appointment-id', patientId: 'patient-id', encounterId: 'encounter-id', initialStageCode: 'CONSULTATION', admission: { paymentCondition: 'PAID' } };
  beforeEach(() => { jest.clearAllMocks(); db.queueJourney.findUnique.mockResolvedValue(null); });

  it('records the patient event in the same transaction as the new ticket', async () => {
    await service.create(input);
    expect(outbox).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: 'queue.ticket_created.v1', aggregateId: ticket.id, payload: expect.objectContaining({ data: { patientId: journey.patientId, journeyId: journey.id } }) }) });
  });

  it('does not create a second notification when admission is retried', async () => {
    db.queueJourney.findUnique.mockResolvedValue(journey);
    await service.create(input);
    expect(outbox).not.toHaveBeenCalled();
  });
});
