import { QueueDomainService } from './queue.service';

describe('Authoritative clinical queue synchronization', () => {
  function fixture() {
    const journey = { id: 'journey', encounterId: 'visit', state: 'ACTIVE', version: 1 };
    const ticket = { id: 'ticket', state: 'WAITING', version: 1, serviceStartedAt: null as any };
    const tx = {
      queueJourney: { findUnique: jest.fn().mockResolvedValue(journey), update: jest.fn(async ({ data }) => Object.assign(journey, { ...data, version: journey.version + 1 })) },
      stageTicket: {
        findMany: jest.fn(async () => ['WAITING', 'CALLED', 'IN_SERVICE'].includes(ticket.state) ? [ticket] : []),
        update: jest.fn(async ({ data }) => Object.assign(ticket, { ...data, version: ticket.version + 1 })),
        count: jest.fn(async () => ['WAITING', 'CALLED', 'IN_SERVICE'].includes(ticket.state) ? 1 : 0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      queueAudit: { create: jest.fn() },
    };
    const db = { ...tx, $transaction: jest.fn(async (work) => work(tx)) };
    const service = new QueueDomainService(db as any, { publish: jest.fn() } as any);
    return { service, journey, ticket, tx };
  }
  it('handles direct opening from WAITING, then completes the ticket and journey', async () => {
    const { service, ticket, journey } = fixture();
    await service.syncClinicalJourney({ appointmentId: 'appointment', encounterId: 'visit', action: 'START' });
    expect(ticket.state).toBe('IN_SERVICE');
    await service.syncClinicalJourney({ appointmentId: 'appointment', encounterId: 'visit', action: 'COMPLETE' });
    expect(ticket.state).toBe('COMPLETED');
    expect(journey.state).toBe('COMPLETED');
  });
  it('is idempotent and a late START cannot reopen a completed ticket', async () => {
    const { service, ticket, journey } = fixture();
    const request = { appointmentId: 'appointment', encounterId: 'visit', action: 'COMPLETE' };
    await service.syncClinicalJourney(request);
    const version = ticket.version;
    await service.syncClinicalJourney(request);
    await service.syncClinicalJourney({ ...request, action: 'START' });
    expect(ticket.state).toBe('COMPLETED');
    expect(ticket.version).toBe(version);
    expect(journey.state).toBe('COMPLETED');
  });
  it('does not close a journey with another stage still pending', async () => {
    const { service, journey, tx } = fixture();
    tx.stageTicket.count.mockResolvedValue(1);
    await service.syncClinicalJourney({ appointmentId: 'appointment', encounterId: 'visit', action: 'COMPLETE' });
    expect(journey.state).toBe('ACTIVE');
  });
  it('rejects another encounter without changing the ticket', async () => {
    const { service, ticket } = fixture();
    await expect(service.syncClinicalJourney({ appointmentId: 'appointment', encounterId: 'other', action: 'COMPLETE' })).rejects.toThrow('ENCOUNTER_MISMATCH');
    expect(ticket.state).toBe('WAITING');
  });
});
