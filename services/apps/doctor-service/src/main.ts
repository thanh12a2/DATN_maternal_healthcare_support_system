import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { DoctorExceptionFilter } from './common/http-exception.filter';
import { DoctorServiceModule } from './doctor-service.module';
async function bootstrap() {
  const app = await NestFactory.create(DoctorServiceModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new DoctorExceptionFilter());
  connectGrpcServer(app, { package: 'maternal.doctor.v1', proto: 'doctor/v1/doctor_internal.proto', url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6005') });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 5005);
}
void bootstrap();
