import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { CatalogDatabaseModule } from './database/catalog-database.module';
import { ServiceCatalogController } from './service-catalog.controller';
import { ServiceCatalogService } from './service-catalog.service';
import { PlatformModule } from '@platform';
import { CatalogGrpcController } from './grpc/catalog-grpc.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CatalogDatabaseModule,
    CatalogModule,
    PlatformModule,
  ],
  controllers: [ServiceCatalogController, CatalogGrpcController],
  providers: [ServiceCatalogService],
})
export class ServiceCatalogModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
