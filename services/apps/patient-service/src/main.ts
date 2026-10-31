import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { configurePatientApp } from './app-bootstrap';
import { PatientServiceModule } from './patient-service.module';
async function bootstrap() {
  const app = await NestFactory.create(PatientServiceModule);
  configurePatientApp(app);
  connectGrpcServer(app, { package: 'maternal.patient.v1', proto: 'patient/v1/patient_internal.proto', url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6004') });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 5004);
}
void bootstrap();
