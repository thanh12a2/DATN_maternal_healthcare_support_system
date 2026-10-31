import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/patient-client';
@Injectable()
export class PatientDatabaseService
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor() {
    super({ datasourceUrl: process.env.PATIENT_DATABASE_URL });
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
