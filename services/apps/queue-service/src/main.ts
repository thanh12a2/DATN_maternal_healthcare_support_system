import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { QueueServiceModule } from './queue-service.module';
async function bootstrap() {
  const app = await NestFactory.create(QueueServiceModule);
  connectGrpcServer(app, {
    package: 'maternal.queue.v1',
    proto: 'queue/v1/queue_internal.proto',
    url: '0.0.0.0:' + (process.env.GRPC_PORT ?? '6012'),
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 5012);
}
void bootstrap();
