import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmailDeliveryService } from './email-delivery.service';
import { SmtpEmailService } from './smtp-email.service';

const live = process.env.NOTIFICATION_SMTP_INTEGRATION === '1';

(live ? describe : describe.skip)('notification email worker with configured SMTP', () => {
  it('renders a synthetic paid appointment and records SMTP acceptance', async () => {
    const source = readFileSync(join(process.cwd(), '..', '.env'), 'utf8');
    const value = (key: string) => source.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    const configValues = Object.fromEntries([
      'NOTIFICATION_SMTP_HOST', 'NOTIFICATION_SMTP_PORT', 'NOTIFICATION_SMTP_SECURE',
      'NOTIFICATION_SMTP_USER', 'NOTIFICATION_SMTP_PASSWORD', 'NOTIFICATION_EMAIL_FROM',
    ].map(key => [key, value(key)]));
    if (!configValues.NOTIFICATION_SMTP_HOST || !configValues.NOTIFICATION_SMTP_USER ||
        !configValues.NOTIFICATION_SMTP_PASSWORD || !configValues.NOTIFICATION_EMAIL_FROM)
      throw new Error('SMTP integration configuration is incomplete');

    const config = { get: (key: string) => configValues[key] } as any;
    const appointmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const patientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const job = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'APPOINTMENT_PAID',
      event_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', appointment_id: appointmentId,
      patient_id: patientId, encounter_id: null, occurred_at: new Date(),
    };
    const update = jest.fn();
    const rows = jest.fn().mockResolvedValueOnce([job]).mockResolvedValue([]);
    const db = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({
        $queryRaw: rows, notificationEmailJob: { update },
      }),
      notificationEmailJob: { updateMany: jest.fn() },
    } as any;
    const grpc = {
      client: () => ({}), metadata: () => ({}),
      unary: jest.fn()
        .mockResolvedValueOnce({ found: true, accountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', patientName: 'SMTP Integration Test' })
        .mockResolvedValueOnce({ found: true, email: configValues.NOTIFICATION_SMTP_USER })
        .mockResolvedValueOnce({ appointment: {
          patientId, appointmentCode: 'SMTP-TEST', status: 'APPOINTMENT_STATUS_BOOKED',
          pricing: { serviceName: 'Synthetic consultation' },
          startAt: { seconds: String(Math.floor(Date.now() / 1000) + 86400) },
          endAt: { seconds: String(Math.floor(Date.now() / 1000) + 88200) },
        } }),
    } as any;
    const worker = new EmailDeliveryService(db, config, grpc, new SmtpEmailService(config));
    await worker.flush();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SENT', providerMessageId: expect.any(String) }),
    }));
  }, 30000);

  it('sends a synthetic clinical summary and a results attachment through SMTP', async () => {
    const source = readFileSync(join(process.cwd(), '..', '.env'), 'utf8');
    const value = (key: string) => source.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    const configValues = Object.fromEntries([
      'NOTIFICATION_SMTP_HOST', 'NOTIFICATION_SMTP_PORT', 'NOTIFICATION_SMTP_SECURE',
      'NOTIFICATION_SMTP_USER', 'NOTIFICATION_SMTP_PASSWORD', 'NOTIFICATION_EMAIL_FROM',
    ].map(key => [key, value(key)]));
    if (!configValues.NOTIFICATION_SMTP_HOST || !configValues.NOTIFICATION_SMTP_USER ||
        !configValues.NOTIFICATION_SMTP_PASSWORD || !configValues.NOTIFICATION_EMAIL_FROM)
      throw new Error('SMTP integration configuration is incomplete');

    const patientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const appointmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const encounterId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const makeJob = (kind: string, id: string) => ({
      id, kind, event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      appointment_id: appointmentId, patient_id: patientId, encounter_id: encounterId,
      occurred_at: new Date(),
    });
    const update = jest.fn();
    const rows = jest.fn()
      .mockResolvedValueOnce([makeJob('CLINICAL_SUMMARY', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')])
      .mockResolvedValueOnce([makeJob('CLINICAL_RESULTS', 'ffffffff-ffff-4fff-8fff-ffffffffffff')])
      .mockResolvedValue([]);
    const db = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({
        $queryRaw: rows, notificationEmailJob: { update },
      }),
      notificationEmailJob: { updateMany: jest.fn() },
    } as any;
    const patient = { found: true, accountId: '99999999-9999-4999-8999-999999999999', patientName: 'SMTP Integration Test' };
    const recipient = { found: true, email: configValues.NOTIFICATION_SMTP_USER };
    const appointment = { appointment: { patientId, appointmentCode: 'SMTP-TEST', status: 'APPOINTMENT_STATUS_BOOKED' } };
    const grpc = {
      client: () => ({}), metadata: () => ({}),
      unary: jest.fn()
        .mockResolvedValueOnce(patient).mockResolvedValueOnce(recipient).mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce({ prescriptions: [{ patientId, encounterId, items: [{ medicationName: 'Synthetic medicine' }] }] })
        .mockResolvedValueOnce({ plans: [{ patientId, sourceEncounterId: encounterId, title: 'Synthetic plan' }] })
        .mockResolvedValueOnce(patient).mockResolvedValueOnce(recipient).mockResolvedValueOnce(appointment)
        .mockResolvedValueOnce({ files: [{ fileName: 'synthetic-result.pdf', mediaType: 'application/pdf', content: Buffer.from('%PDF-1.4\n%%EOF') }] }),
    } as any;
    const config = { get: (key: string) => configValues[key] } as any;
    const worker = new EmailDeliveryService(db, config, grpc, new SmtpEmailService(config));
    await worker.flush();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
  }, 45000);
});
