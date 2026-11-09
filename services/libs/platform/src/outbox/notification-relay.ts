import { Logger } from '@nestjs/common';
import { RabbitMqPublisher } from '../rabbitmq/rabbitmq.publisher';

/** Publishes a separate, durable view of an existing domain outbox. */
export class NotificationRelay {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationRelay.name);

  constructor(private readonly db: any, private readonly publisher: RabbitMqPublisher,
    private readonly producer: string, private readonly table: 'billing_outbox_events' | 'queue_outbox' | 'consultation_outbox',
    private readonly events: string[]) {}

  start() {
    if (!this.publisher.isEnabled()) return;
    this.timer = setInterval(() => void this.flush(), 1000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      await this.publisher.ensureBindings('maternal.notification.delivery.v1', this.events);
      if (this.producer === 'billing-service') await this.publisher.ensureBindings('maternal.reception.payment.v1', ['billing.payment_recorded.v1']);
      for (let i = 0; i < 20; i++) {
        const sent = await this.db.$transaction(async (tx: any) => {
          // Table names and event names are application constants, never request input.
          const eventNames = this.events.map(x => `'${x.replace(/'/g, "''")}'`).join(',');
          const rows = await tx.$queryRawUnsafe(`SELECT e.id, e.event_type, e.payload, e.occurred_at FROM ${this.table} e WHERE e.event_type IN (${eventNames}) AND e.occurred_at >= (SELECT enabled_from FROM notification_relay_settings WHERE id = 1) AND NOT EXISTS (SELECT 1 FROM notification_relay_published p WHERE p.event_id = e.id) ORDER BY e.occurred_at, e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED`);
          const row = rows[0];
          if (!row) return false;
          await this.publisher.publish(row.event_type, { eventId: row.id, eventType: row.event_type, eventVersion: Number(row.payload.eventVersion ?? 1), aggregateType: String(row.payload.aggregateType ?? ''), aggregateId: String(row.payload.aggregateId ?? ''), occurredAt: row.occurred_at.toISOString(), correlationId: row.id, producer: this.producer, data: row.payload.data ?? {} });
          await tx.$executeRaw`INSERT INTO notification_relay_published (event_id) VALUES (${row.id}::uuid) ON CONFLICT DO NOTHING`;
          return true;
        }, { timeout: 15000 });
        if (!sent) break;
      }
    } catch (error) { this.logger.warn(`${this.producer} notification relay unavailable: ${error instanceof Error ? error.name : 'unknown'}`); }
    finally { this.running = false; }
  }
}
