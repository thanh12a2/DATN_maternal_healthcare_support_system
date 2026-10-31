import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  connectGrpcServer(app, {
    package: 'maternal.auth.v1',
    proto: 'auth/v1/auth_internal.proto',
    url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6003'),
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 5003);
}
void bootstrap();
