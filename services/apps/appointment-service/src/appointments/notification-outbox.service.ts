import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitMqPublisher } from '@platform';
import { AppointmentPrismaService } from '../database/prisma.service';

const events = ['appointment.booked.v1', 'appointment.cancelled.v1', 'appointment.rescheduled.v1', 'appointment.reassigned.v1'];
type Row = { id: string; event_type: string; payload: any; occurred_at: Date };

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: AppointmentPrismaService, private readonly publisher: RabbitMqPublisher) {}
  onModuleInit() { if (this.publisher.isEnabled()) { this.timer = setInterval(() => void this.flush(), 1000); this.timer.unref(); } }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      await this.publisher.ensureBindings('maternal.notification.delivery.v1', events);
      for (let i = 0; i < 20; i++) {
        const published = await this.db.$transaction(async tx => {
          const rows = await tx.$queryRaw<Row[]>`SELECT e.id, e.event_type, e.payload, e.occurred_at FROM appointment_outbox_events e WHERE e.event_type IN ('appointment.booked.v1','appointment.cancelled.v1','appointment.rescheduled.v1','appointment.reassigned.v1') AND e.occurred_at >= (SELECT enabled_from FROM notification_relay_settings WHERE id = 1) AND NOT EXISTS (SELECT 1 FROM notification_relay_published p WHERE p.event_id = e.id) ORDER BY e.occurred_at, e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED`;
          const row = rows[0];
          if (!row) return false;
          await this.publisher.publish(row.event_type, { eventId: row.id, eventType: row.event_type, eventVersion: Number(row.payload.eventVersion ?? 1), aggregateType: String(row.payload.aggregateType ?? 'appointment'), aggregateId: String(row.payload.aggregateId ?? ''), occurredAt: row.occurred_at.toISOString(), correlationId: row.id, producer: 'appointment-service', data: row.payload.data ?? {} });
          await tx.$executeRaw`INSERT INTO notification_relay_published (event_id) VALUES (${row.id}::uuid) ON CONFLICT DO NOTHING`;
          return true;
        }, { timeout: 15000 });
        if (!published) break;
      }
    } catch (error) { this.logger.warn(`Appointment event relay unavailable: ${error instanceof Error ? error.name : 'unknown'}`); }
    finally { this.running = false; }
  }
}
