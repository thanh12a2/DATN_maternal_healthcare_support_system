import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from 'amqplib';
import type { DomainEventEnvelope } from './rabbitmq.publisher';

@Injectable()
export class RabbitMqConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumer.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private stopping = false;

  constructor(private readonly config: ConfigService) {}

  async subscribe(input: {
    queue: string;
    routingKeys: string[];
    handler: (event: DomainEventEnvelope) => Promise<void>;
    requeueOnError?: boolean;
  }): Promise<void> {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url)
      throw new Error('RabbitMQ consumer is disabled: RABBITMQ_URL is missing');
    try {
      this.connection ??= await amqp.connect(url);
      this.channel ??= await this.connection.createChannel();
      if (input.requeueOnError) {
        const connection = this.connection;
        connection.on('error', () => undefined);
        connection.once('close', () => {
          if (this.connection !== connection) return;
          this.connection = undefined;
          this.channel = undefined;
          this.reconnect(input);
        });
      }
      const exchange =
        this.config.get<string>('RABBITMQ_DOMAIN_EXCHANGE') ??
        'maternal.domain.v1';
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
      await this.channel.assertQueue(input.queue, { durable: true });
      for (const key of input.routingKeys)
        await this.channel.bindQueue(input.queue, exchange, key);
      await this.channel.prefetch(
        Number(this.config.get('RABBITMQ_PREFETCH') ?? 20),
      );
      await this.channel.consume(
        input.queue,
        (message) =>
          void this.handle(message, input.handler, input.requeueOnError),
        { noAck: false },
      );
    } catch (error) {
      if (!input.requeueOnError) throw error;
      await this.channel?.close().catch(() => undefined);
      await this.connection?.close().catch(() => undefined);
      this.channel = undefined;
      this.connection = undefined;
      this.logger.warn('RabbitMQ consumer unavailable; retrying');
      this.reconnect(input);
    }
  }

  private reconnect(input: Parameters<RabbitMqConsumer['subscribe']>[0]) {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.subscribe(input);
    }, 5000);
    this.reconnectTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async handle(
    message: ConsumeMessage | null,
    handler: (event: DomainEventEnvelope) => Promise<void>,
    requeueOnError = false,
  ): Promise<void> {
    const channel = this.channel;
    if (!message || !channel) return;
    try {
      await handler(
        JSON.parse(message.content.toString('utf8')) as DomainEventEnvelope,
      );
      channel.ack(message);
    } catch (error) {
      this.logger.error('RabbitMQ consumer handler failed', error);
      const requeue = requeueOnError && !(error instanceof SyntaxError);
      if (requeue)
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      try {
        channel.nack(message, false, requeue);
      } catch {
        /* A closed channel already requeues unacknowledged messages. */
      }
    }
  }
}
