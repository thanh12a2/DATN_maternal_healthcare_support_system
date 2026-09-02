import { NestFactory } from '@nestjs/core';
import { configurePatientApp } from './app-bootstrap';
import { PatientServiceModule } from './patient-service.module';
async function bootstrap() {
  const app = await NestFactory.create(PatientServiceModule);
  configurePatientApp(app);
  await app.listen(process.env.PORT ?? 5004);
}
void bootstrap();
