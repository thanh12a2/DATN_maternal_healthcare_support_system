import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CatalogExceptionFilter } from './common/catalog-exception.filter';

export function configureCatalogApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new CatalogExceptionFilter());
}
