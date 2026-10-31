import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';

export interface DomainEventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  producer: string;
  data: T;
}

@Injectable()
export class RabbitMqPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('RABBITMQ_URL'));
  }

  async publish(routingKey: string, event: DomainEventEnvelope): Promise<void> {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) throw new Error('RabbitMQ publisher is disabled: RABBITMQ_URL is missing');
    const channel = await this.getChannel(url);
    const exchange = this.config.get<string>('RABBITMQ_DOMAIN_EXCHANGE') ?? 'maternal.domain.v1';
    await channel.assertExchange(exchange, 'topic', { durable: true });
    const accepted = channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true, contentType: 'application/json', messageId: event.eventId, timestamp: Date.now() },
    );
    if (!accepted) await new Promise<void>((resolve) => channel.once('drain', resolve));
    await channel.waitForConfirms();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async getChannel(url: string): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    this.connection = await amqp.connect(url);
    this.connection.on('error', (error) => this.logger.error('RabbitMQ connection error', error));
    this.channel = await this.connection.createConfirmChannel();
    return this.channel;
  }
}
