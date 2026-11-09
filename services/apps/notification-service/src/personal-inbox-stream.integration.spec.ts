import { ConfigService } from '@nestjs/config';
import { RabbitMqPublisher } from '@platform';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/notification-client';
import { PersonalInboxRelayService } from './personal-inbox-relay.service';
import { ReceptionWorkStreamService } from './reception-work-stream.service';

const enabled = process.env.PERSONAL_INBOX_INTEGRATION === '1';
(enabled ? describe : describe.skip)('personal inbox SSE routing', () => {
  it('routes committed creates and read changes only to the matching account across instances', async () => {
    if (!process.env.NOTIFICATION_DATABASE_URL?.includes('/codex_personal_inbox_test')) throw new Error('Isolated database required');
    const config = new ConfigService({ RABBITMQ_URL: process.env.RABBITMQ_URL, RABBITMQ_DOMAIN_EXCHANGE: 'codex.personal.test' });
    const first = new ReceptionWorkStreamService(config), second = new ReceptionWorkStreamService(config);
    const publisher = new RabbitMqPublisher(config), db = new PrismaClient();
    const relay = new PersonalInboxRelayService(db as any, publisher);
    const account = randomUUID(), other = randomUUID(), id = randomUUID(), source = randomUUID();
    const tabA = jest.fn(), tabB = jest.fn(), otherTab = jest.fn();
    first.subscribeAccount(account, tabA); second.subscribeAccount(account, tabB); second.subscribeAccount(other, otherTab);
    try {
      await (first as any).connect(); await (second as any).connect();
      tabA.mockClear(); tabB.mockClear(); otherTab.mockClear();
      await db.$executeRaw`INSERT INTO notifications(id,source_event_id,event_type,recipient_account_id,template_code,category,title,body) VALUES (${id}::uuid,${source}::uuid,'test',${account}::uuid,'test','BOOKING','Test','Test')`;
      await relay.flush();
      for (let i = 0; i < 50 && (!tabA.mock.calls.length || !tabB.mock.calls.length); i++) await new Promise(resolve => setTimeout(resolve, 100));
      expect(tabA).toHaveBeenCalledTimes(1); expect(tabB).toHaveBeenCalledTimes(1); expect(otherTab).not.toHaveBeenCalled();
      await db.$executeRaw`UPDATE notifications SET read_at = now() WHERE id = ${id}::uuid`;
      await relay.flush();
      for (let i = 0; i < 50 && tabA.mock.calls.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 100));
      expect(tabA).toHaveBeenCalledTimes(2); expect(otherTab).not.toHaveBeenCalled();
      await db.$executeRaw`UPDATE notifications SET read_at = read_at WHERE id = ${id}::uuid`;
      await expect(db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE notifications SET read_at = NULL WHERE id = ${id}::uuid`;
        throw new Error('rollback');
      })).rejects.toThrow('rollback');
      await relay.flush();
      const pending = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM personal_inbox_signal_outbox`;
      expect(Number(pending[0].count)).toBe(0);
      expect(tabA).toHaveBeenCalledTimes(2);
    } finally { await first.onModuleDestroy(); await second.onModuleDestroy(); await publisher.onModuleDestroy(); await db.$disconnect(); }
  }, 20000);

  it('asks connected accounts to resynchronize after the broker channel reconnects', async () => {
    const config = new ConfigService({ RABBITMQ_URL: process.env.RABBITMQ_URL, RABBITMQ_DOMAIN_EXCHANGE: 'codex.personal.test' });
    const stream = new ReceptionWorkStreamService(config), listener = jest.fn();
    stream.subscribeAccount(randomUUID(), listener);
    try {
      await (stream as any).connect(); listener.mockClear();
      await (stream as any).channel.close();
      for (let i = 0; i < 100 && !listener.mock.calls.length; i++) await new Promise(resolve => setTimeout(resolve, 100));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally { await stream.onModuleDestroy(); }
  }, 20000);
});
