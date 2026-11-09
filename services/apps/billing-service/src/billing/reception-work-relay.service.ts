import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitMqPublisher, ReceptionWorkRelay } from '@platform';
import { BillingPrismaService } from '../database/prisma.service';

@Injectable()
export class ReceptionWorkRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly relay: ReceptionWorkRelay;
  constructor(db: BillingPrismaService, publisher: RabbitMqPublisher) { this.relay = new ReceptionWorkRelay(db, publisher, 'billing-service'); }
  onModuleInit() { this.relay.start(); }
  onModuleDestroy() { this.relay.stop(); }
}
