import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitMqPublisher, ReceptionWorkRelay } from '@platform';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReceptionWorkRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly relay: ReceptionWorkRelay;
  constructor(db: PrismaService, publisher: RabbitMqPublisher) { this.relay = new ReceptionWorkRelay(db, publisher, 'receptionist-service'); }
  onModuleInit() { this.relay.start(); }
  onModuleDestroy() { this.relay.stop(); }
}
