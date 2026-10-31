import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/queue-client';
@Injectable()
export class QueuePrismaService
  extends PrismaClient
  implements OnModuleDestroy
{
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
