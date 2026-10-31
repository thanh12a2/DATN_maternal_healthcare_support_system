import type { DomainEventEnvelope } from '../rabbitmq/rabbitmq.publisher';

export interface PendingOutboxRecord {
  id: string;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
  correlationId?: string | null;
}

export interface OutboxStore {
  claimBatch(limit: number): Promise<PendingOutboxRecord[]>;
  markPublished(id: string, publishedAt: Date): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}

export interface EventPublisher {
  publish(routingKey: string, event: DomainEventEnvelope): Promise<void>;
}

export class OutboxRelay {
  constructor(
    private readonly store: OutboxStore,
    private readonly publisher: EventPublisher,
    private readonly producer: string,
  ) {}

  async flush(limit = 100): Promise<number> {
    const records = await this.store.claimBatch(limit);
    for (const record of records) {
      try {
        const payload = record.payload as Record<string, unknown>;
        await this.publisher.publish(record.eventType, {
          eventId: record.id,
          eventType: record.eventType,
          eventVersion: Number(payload.eventVersion ?? 1),
          aggregateType: String(payload.aggregateType ?? 'unknown'),
          aggregateId: String(payload.aggregateId ?? ''),
          occurredAt: record.occurredAt.toISOString(),
          correlationId: record.correlationId ?? String(payload.correlationId ?? record.id),
          producer: this.producer,
          data: (payload.data ?? payload) as Record<string, unknown>,
        });
        await this.store.markPublished(record.id, new Date());
      } catch (error) {
        await this.store.markFailed(record.id, error instanceof Error ? error.message : 'publish failed');
      }
    }
    return records.length;
  }
}
