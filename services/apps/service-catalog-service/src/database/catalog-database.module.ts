import { Global, Module } from '@nestjs/common';
import { CatalogDatabaseService } from './catalog-database.service';

@Global()
@Module({
  providers: [CatalogDatabaseService],
  exports: [CatalogDatabaseService],
})
export class CatalogDatabaseModule {}
