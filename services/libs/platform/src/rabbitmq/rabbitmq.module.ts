import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqPublisher } from './rabbitmq.publisher';
import { RabbitMqConsumer } from './rabbitmq.consumer';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RabbitMqPublisher, RabbitMqConsumer],
  exports: [RabbitMqPublisher, RabbitMqConsumer],
})
export class RabbitMqModule {}
