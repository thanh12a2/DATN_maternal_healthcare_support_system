import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/medical-record-client';
@Injectable()
export class MedicalPrismaService
  extends PrismaClient
  implements OnModuleDestroy
{
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
