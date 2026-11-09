import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitMqPublisher } from '@platform';
import { AppPrismaService } from './database/prisma.service';

@Injectable()
export class PersonalInboxRelayService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PersonalInboxRelayService.name);
  constructor(private readonly db: AppPrismaService, private readonly publisher: RabbitMqPublisher) {}
  onModuleInit() { if (this.publisher.isEnabled()) { void this.flush(); this.timer = setInterval(() => void this.flush(), 1000); this.timer.unref(); } }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 50; i++) {
        const sent = await this.db.$transaction(async tx => {
          const rows = await tx.$queryRaw<{ id: string; recipient_account_id: string; occurred_at: Date }[]>`SELECT id, recipient_account_id, occurred_at FROM personal_inbox_signal_outbox ORDER BY occurred_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
          const item = rows[0]; if (!item) return false;
          await this.publisher.publish('notification.inbox.changed.v1', { eventId: item.id, eventType: 'notification.inbox.changed.v1', eventVersion: 1, aggregateType: 'notification_inbox', aggregateId: item.id, occurredAt: item.occurred_at.toISOString(), correlationId: item.id, producer: 'notification-service', data: { recipientAccountId: item.recipient_account_id } });
          await tx.$executeRaw`DELETE FROM personal_inbox_signal_outbox WHERE id = ${item.id}::uuid`;
          return true;
        }, { timeout: 15000 });
        if (!sent) break;
      }
    } catch { this.logger.warn('Personal inbox relay unavailable; retrying'); }
    finally { this.running = false; }
  }
}
