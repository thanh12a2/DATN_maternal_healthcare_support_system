import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitMqPublisher } from '@platform';
import { MedicalPrismaService } from '../database/prisma.service';

@Injectable()
export class ClinicalEmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClinicalEmailOutboxService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: MedicalPrismaService, private readonly publisher: RabbitMqPublisher) {}
  onModuleInit() { if (this.publisher.isEnabled()) { this.timer = setInterval(() => void this.flush(), 1000); this.timer.unref(); } }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      await this.publisher.ensureBindings('maternal.notification.delivery.v1', ['medical.encounter_finalized.v1']);
      for (let i = 0; i < 20; i++) {
        const sent = await this.db.$transaction(async tx => {
          const rows = await tx.$queryRaw<{ id: string; event_type: string; payload: any; occurred_at: Date }[]>`SELECT e.id, e.event_type, e.payload, e.occurred_at FROM medical_outbox e WHERE e.event_type = 'medical.encounter_finalized.v1' AND e.occurred_at >= (SELECT enabled_from FROM clinical_email_relay_settings WHERE id = 1) AND NOT EXISTS (SELECT 1 FROM clinical_email_relay_published p WHERE p.event_id = e.id) ORDER BY e.occurred_at, e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
          const row = rows[0]; if (!row) return false;
          await this.publisher.publish(row.event_type, { eventId: row.id, eventType: row.event_type, eventVersion: Number(row.payload.eventVersion ?? 1), aggregateType: String(row.payload.aggregateType ?? ''), aggregateId: String(row.payload.aggregateId ?? ''), occurredAt: row.occurred_at.toISOString(), correlationId: row.id, producer: 'medical-record-service', data: row.payload.data ?? {} });
          await tx.$executeRaw`INSERT INTO clinical_email_relay_published(event_id) VALUES (${row.id}::uuid) ON CONFLICT DO NOTHING`;
          return true;
        }, { timeout: 15000 });
        if (!sent) break;
      }
    } catch { this.logger.warn('Clinical email event relay unavailable; retrying'); }
    finally { this.running = false; }
  }
}
