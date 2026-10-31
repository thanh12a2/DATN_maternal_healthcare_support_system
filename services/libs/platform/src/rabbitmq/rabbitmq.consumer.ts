import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import type { DomainEventEnvelope } from './rabbitmq.publisher';

@Injectable()
export class RabbitMqConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumer.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly config: ConfigService) {}

  async subscribe(input: {
    queue: string;
    routingKeys: string[];
    handler: (event: DomainEventEnvelope) => Promise<void>;
  }): Promise<void> {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) throw new Error('RabbitMQ consumer is disabled: RABBITMQ_URL is missing');
    this.connection ??= await amqp.connect(url);
    this.channel ??= await this.connection.createChannel();
    const exchange = this.config.get<string>('RABBITMQ_DOMAIN_EXCHANGE') ?? 'maternal.domain.v1';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(input.queue, { durable: true });
    for (const key of input.routingKeys) await this.channel.bindQueue(input.queue, exchange, key);
    await this.channel.prefetch(Number(this.config.get('RABBITMQ_PREFETCH') ?? 20));
    await this.channel.consume(input.queue, (message) => void this.handle(message, input.handler), { noAck: false });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async handle(message: ConsumeMessage | null, handler: (event: DomainEventEnvelope) => Promise<void>): Promise<void> {
    if (!message || !this.channel) return;
    try {
      await handler(JSON.parse(message.content.toString('utf8')) as DomainEventEnvelope);
      this.channel.ack(message);
    } catch (error) {
      this.logger.error('RabbitMQ consumer handler failed', error);
      this.channel.nack(message, false, false);
    }
  }
}
