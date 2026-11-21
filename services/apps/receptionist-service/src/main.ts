import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor';
import { ReceptionistServiceModule } from './receptionist-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ReceptionistServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.enableShutdownHooks();

  connectGrpcServer(app, { package: 'maternal.receptionist.v1', proto: 'receptionist/v1/reception_work_internal.proto', url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6006') });
  await app.startAllMicroservices();

  await app.listen(process.env.PORT ?? 5006);
}
void bootstrap();
