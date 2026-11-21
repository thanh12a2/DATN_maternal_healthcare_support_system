import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationRelay, RabbitMqPublisher } from '@platform';
import { QueuePrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly relay: NotificationRelay;
  constructor(db: QueuePrismaService, publisher: RabbitMqPublisher) {
    this.relay = new NotificationRelay(db, publisher, 'queue-service', 'queue_outbox', ['queue.ticket_created.v1', 'queue.ticket_called.v1', 'queue.ticket_requeued.v1', 'queue.ticket_cancelled.v1']);
  }
  onModuleInit() { this.relay.start(); }
  onModuleDestroy() { this.relay.stop(); }
}
