import { ConfigService } from '@nestjs/config';
import { RabbitMqPublisher, ReceptionWorkRelay } from '@platform';
import { ReceptionWorkStreamService } from './reception-work-stream.service';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/receptionist-client';

const enabled = process.env.RECEPTION_STREAM_INTEGRATION === '1';
(enabled ? describe : describe.skip)('reception work broadcast', () => {
  it('delivers the same signal to both service instances', async () => {
    const config = new ConfigService({ RABBITMQ_URL: process.env.RABBITMQ_URL, RABBITMQ_DOMAIN_EXCHANGE: 'codex.reception.test' });
    const first = new ReceptionWorkStreamService(config), second = new ReceptionWorkStreamService(config);
    const publisher = new RabbitMqPublisher(config);
    const a = jest.fn(), b = jest.fn(); first.subscribe(a); second.subscribe(b);
    try {
      await (first as any).connect(); await (second as any).connect();
      a.mockClear(); b.mockClear();
      const id = randomUUID();
      await publisher.publish('reception.work.changed.v1', { eventId: id, eventType: 'reception.work.changed.v1', eventVersion: 1, aggregateType: 'reception_work', aggregateId: id, occurredAt: new Date().toISOString(), correlationId: id, producer: 'test', data: { category: 'case' } });
      for (let i = 0; i < 50 && (!a.mock.calls.length || !b.mock.calls.length); i++) await new Promise(resolve => setTimeout(resolve, 100));
      expect(a).toHaveBeenCalledWith('case'); expect(b).toHaveBeenCalledWith('case');
    } finally { await first.onModuleDestroy(); await second.onModuleDestroy(); await publisher.onModuleDestroy(); }
  }, 20000);

  it('publishes a committed database signal through the relay', async () => {
    if (!process.env.RECEPTIONIST_DATABASE_URL?.includes('/codex_reception_work_test')) throw new Error('Isolated database required');
    const config = new ConfigService({ RABBITMQ_URL: process.env.RABBITMQ_URL, RABBITMQ_DOMAIN_EXCHANGE: 'codex.reception.test' });
    const stream = new ReceptionWorkStreamService(config), publisher = new RabbitMqPublisher(config), db = new PrismaClient();
    const received = jest.fn(); stream.subscribe(received);
    try {
      await (stream as any).connect(); received.mockClear();
      await db.$executeRaw`DELETE FROM reception_work_signal_outbox`;
      await db.$executeRaw`INSERT INTO reception_work_signal_outbox(category) VALUES ('case')`;
      const relay = new ReceptionWorkRelay(db, publisher, 'test');
      await relay.flush();
      for (let i = 0; i < 50 && !received.mock.calls.length; i++) await new Promise(resolve => setTimeout(resolve, 100));
      expect(received).toHaveBeenCalledWith('case');
      const remaining = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM reception_work_signal_outbox`;
      expect(Number(remaining[0].count)).toBe(0);
    } finally { await stream.onModuleDestroy(); await publisher.onModuleDestroy(); await db.$disconnect(); }
  }, 20000);
});
