import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationRelay, RabbitMqPublisher } from '@platform';
import { AppPrismaService } from './database/prisma.service';

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly relay: NotificationRelay;
  constructor(db: AppPrismaService, publisher: RabbitMqPublisher) {
    this.relay = new NotificationRelay(db, publisher, 'consultation-service', 'consultation_outbox', ['consultation.assigned.v1']);
  }
  onModuleInit() { this.relay.start(); }
  onModuleDestroy() { this.relay.stop(); }
}