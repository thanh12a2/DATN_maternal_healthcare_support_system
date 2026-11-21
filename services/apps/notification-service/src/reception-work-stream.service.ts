import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type Channel, type ChannelModel } from 'amqplib';

/** Each instance has its own ephemeral queue: all connected instances receive each signal. */
@Injectable()
export class ReceptionWorkStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReceptionWorkStreamService.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private reconnect?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private readonly listeners = new Set<(category: string) => void>();
  private readonly accounts = new Map<string, Set<() => void>>();

  constructor(private readonly config: ConfigService) {}
  onModuleInit() { void this.connect(); }
  subscribe(listener: (category: string) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  subscribeAccount(accountId: string, listener: () => void) {
    const key = accountId.toLowerCase();
    const listeners = this.accounts.get(key) ?? new Set<() => void>();
    listeners.add(listener); this.accounts.set(key, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.accounts.delete(key); };
  }

  private async connect() {
    if (this.stopped) return;
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) return;
    try {
      const connection = await amqp.connect(url);
      if (this.stopped) { await connection.close(); return; }
      this.connection = connection;
      connection.on('error', () => undefined);
      connection.once('close', () => { if (this.connection === connection) { this.connection = undefined; this.channel = undefined; this.scheduleReconnect(); } });
      const channel = await connection.createChannel();
      this.channel = channel;
      channel.on('error', () => undefined);
      channel.once('close', () => {
        if (this.channel !== channel) return;
        this.channel = undefined;
        void connection.close().catch(() => undefined);
        this.scheduleReconnect();
      });
      const exchange = this.config.get<string>('RABBITMQ_DOMAIN_EXCHANGE') ?? 'maternal.domain.v1';
      await channel.assertExchange(exchange, 'topic', { durable: true });
      const queue = await channel.assertQueue('', { exclusive: true, autoDelete: true });
      await channel.bindQueue(queue.queue, exchange, 'reception.work.changed.v1');
      await channel.bindQueue(queue.queue, exchange, 'notification.inbox.changed.v1');
      await channel.consume(queue.queue, message => {
        if (!message) return;
        try {
          const event = JSON.parse(message.content.toString('utf8'));
          if (event?.eventType === 'notification.inbox.changed.v1') {
            const accountId = event?.data?.recipientAccountId;
            if (typeof accountId === 'string') for (const listener of this.accounts.get(accountId.toLowerCase()) ?? []) { try { listener(); } catch { /* disconnected client */ } }
            return;
          }
          const category = event?.data?.category;
          if (['case', 'payment'].includes(category)) {
            for (const listener of this.listeners) { try { listener(category); } catch { /* disconnected client */ } }
          }
        } catch { this.logger.warn('Invalid reception work signal'); }
      }, { noAck: true });
      // A broker interruption may have missed transient signals. Refresh live clients.
      for (const listener of this.listeners) { try { listener('all'); } catch { /* disconnected client */ } }
      for (const listeners of this.accounts.values()) for (const listener of listeners) { try { listener(); } catch { /* disconnected client */ } }
    } catch {
      await this.channel?.close().catch(() => undefined);
      await this.connection?.close().catch(() => undefined);
      this.channel = undefined; this.connection = undefined;
      this.logger.warn('Reception work stream unavailable; reconnecting');
      this.scheduleReconnect();
    }
  }
  private scheduleReconnect() {
    if (this.stopped || this.reconnect) return;
    this.reconnect = setTimeout(() => { this.reconnect = undefined; void this.connect(); }, 5000);
    this.reconnect.unref();
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.reconnect) clearTimeout(this.reconnect);
    this.listeners.clear();
    this.accounts.clear();
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
