import { NestFactory } from '@nestjs/core';
import { PatientServiceModule } from './patient-service.module';

async function bootstrap() {
  const app = await NestFactory.create(PatientServiceModule);
  await app.listen(process.env.PORT ?? 5004);
}
bootstrap();
