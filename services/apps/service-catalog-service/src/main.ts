import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { configureCatalogApp } from './app-bootstrap';
import { ServiceCatalogModule } from './service-catalog.module';
async function bootstrap() {
  const app = await NestFactory.create(ServiceCatalogModule);
  configureCatalogApp(app);
  connectGrpcServer(app, { package: 'maternal.catalog.v1', proto: 'catalog/v1/catalog_internal.proto', url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6007') });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 5007);
}
void bootstrap();
