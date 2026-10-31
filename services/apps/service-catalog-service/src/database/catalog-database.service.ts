import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/catalog-client';

@Injectable()
export class CatalogDatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: process.env.CATALOG_DATABASE_URL });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
