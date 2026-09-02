import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DoctorExceptionFilter } from './common/http-exception.filter';
import { DoctorServiceModule } from './doctor-service.module';

async function bootstrap() {
  const app = await NestFactory.create(DoctorServiceModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DoctorExceptionFilter());
  await app.listen(process.env.PORT ?? 5005);
}
bootstrap();
