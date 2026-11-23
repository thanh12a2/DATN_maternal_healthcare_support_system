import { ReportingService } from './reporting.service';

describe('revenue projection', () => {
  const event = (data: Record<string, unknown>) => ({
    eventId: '00000000-0000-4000-8000-000000000001',
    eventType: 'billing.payment_recorded.v1',
    eventVersion: 1,
    aggregateType: 'invoice',
    aggregateId: 'invoice-1',
    occurredAt: '2026-11-22T08:00:00.000Z',
    correlationId: 'correlation-1',
    producer: 'billing-service',
    data,
  });

  const setup = () => {
    const tx = {
      consumedEvent: { create: jest.fn() },
      dailyMetric: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    };
    const db = {
      consumedEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    return { service: new ReportingService(db as any, {} as any, {} as any), tx };
  };

  it('projects the amount supplied by the payment event', async () => {
    const { service, tx } = setup();
    await service.consume(event({ amountMinor: '125000' }));
    expect(tx.dailyMetric.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        reportType: 'REVENUE_DAILY',
        measures: { collected: 125000, transactions: 1 },
      }),
    }));
  });

  it('does not invent revenue when an old payment event lacks an amount', async () => {
    const { service, tx } = setup();
    await service.consume(event({ invoiceId: 'invoice-1' }));
    expect(tx.dailyMetric.upsert).not.toHaveBeenCalled();
  });

  it('groups an evening UTC payment into the next Vietnam business day', async () => {
    const { service, tx } = setup();
    await service.consume({ ...event({ amountMinor: '90000' }), occurredAt: '2026-11-21T18:00:00.000Z' });
    expect(tx.dailyMetric.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ businessDate: new Date('2026-11-22T00:00:00.000Z') }),
    }));
  });
});
