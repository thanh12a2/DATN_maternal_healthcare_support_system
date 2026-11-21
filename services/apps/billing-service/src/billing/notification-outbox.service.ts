import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationRelay, RabbitMqPublisher } from '@platform';
import { BillingPrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly relay: NotificationRelay;
  constructor(db: BillingPrismaService, publisher: RabbitMqPublisher) {
    this.relay = new NotificationRelay(db, publisher, 'billing-service', 'billing_outbox_events', ['billing.invoice_issued.v1', 'billing.payment_recorded.v1', 'billing.payment_rejected.v1']);
  }
  onModuleInit() { this.relay.start(); }
  onModuleDestroy() { this.relay.stop(); }
}