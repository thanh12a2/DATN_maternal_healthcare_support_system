import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { MedicalRecordServiceModule } from './medical-record-service.module';
async function bootstrap() {
  const app = await NestFactory.create(MedicalRecordServiceModule);
  connectGrpcServer(app, {
    package: 'maternal.medical_record.v1',
    proto: 'medical_record/v1/medical_record_internal.proto',
    url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6011'),
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 5011);
}
void bootstrap();
