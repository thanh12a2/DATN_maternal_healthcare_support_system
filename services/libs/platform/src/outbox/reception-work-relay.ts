import { Logger } from '@nestjs/common';
import { RabbitMqPublisher } from '../rabbitmq/rabbitmq.publisher';

/** Drains a service-local outbox; database triggers write signals in the domain transaction. */
export class ReceptionWorkRelay {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(ReceptionWorkRelay.name);
  constructor(private readonly db: any, private readonly publisher: RabbitMqPublisher, private readonly producer: string) {}
  start() { if (this.publisher.isEnabled()) { void this.flush(); this.timer = setInterval(() => void this.flush(), 1000); this.timer.unref(); } }
  stop() { if (this.timer) clearInterval(this.timer); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 50; i++) {
        const sent = await this.db.$transaction(async (tx: any) => {
          const rows = await tx.$queryRaw`SELECT id, category, occurred_at FROM reception_work_signal_outbox WHERE available_at <= now() ORDER BY available_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
          const event = rows[0]; if (!event) return false;
          await this.publisher.publish('reception.work.changed.v1', { eventId: event.id, eventType: 'reception.work.changed.v1', eventVersion: 1, aggregateType: 'reception_work', aggregateId: event.id, occurredAt: event.occurred_at.toISOString(), correlationId: event.id, producer: this.producer, data: { category: event.category } });
          await tx.$executeRaw`DELETE FROM reception_work_signal_outbox WHERE id = ${event.id}::uuid`;
          return true;
        }, { timeout: 15000 });
        if (!sent) break;
      }
    } catch { this.logger.warn(`${this.producer} reception work relay unavailable; retrying`); }
    finally { this.running = false; }
  }
}
