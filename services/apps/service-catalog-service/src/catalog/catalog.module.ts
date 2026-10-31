import { Module } from '@nestjs/common';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogInternalController } from './catalog-internal.controller';
import { CatalogPublicController } from './catalog-public.controller';
import { CatalogService } from './catalog.service';

@Module({
  // Deprecated compatibility routes; they are never exposed through Kong.
  // New callers must use CatalogInternalService gRPC.
  controllers: [CatalogPublicController, CatalogAdminController, CatalogInternalController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
