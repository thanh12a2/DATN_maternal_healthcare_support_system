import { EmailDeliveryService } from './email-delivery.service';

describe('appointment email jobs', () => {
  const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', appointmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', patientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const upsert = jest.fn(), update = jest.fn(), updateMany = jest.fn(), query = jest.fn(), unary = jest.fn(), send = jest.fn();
  const tx = { $queryRaw: query, notificationEmailJob: { update, upsert } };
  const db = { notificationEmailJob: { upsert, updateMany }, $transaction: (fn: any) => fn(tx) };
  const config = { get: (key: string) => key === 'NOTIFICATION_SMTP_HOST' ? 'localhost' : undefined };
  const grpc = { client: () => ({}), metadata: () => ({}), unary };
  const service = new EmailDeliveryService(db as any, config as any, grpc as any, { send } as any);
  beforeEach(() => jest.clearAllMocks());
  it('stores only a paid event and deduplicates by event and kind', async () => {
    await service.enqueuePayment({ eventId, eventType: 'billing.payment_recorded.v1', eventVersion: 1, occurredAt: '2026-11-09T00:00:00Z', data: { patientId, appointmentId, status: 'PAID' } } as any);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId_kind: { eventId, kind: 'APPOINTMENT_PAID' } }, update: {} }));
    await service.enqueuePayment({ eventId, eventType: 'billing.payment_recorded.v1', eventVersion: 1, occurredAt: '2026-11-09T00:00:00Z', data: { patientId, appointmentId, status: 'PENDING' } } as any);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it('creates two separate jobs for the finalized encounter', async () => {
    await service.enqueueClinical({ eventId, eventType: 'medical.encounter_finalized.v1', eventVersion: 1, occurredAt: '2026-11-09T00:00:00Z', data: { patientId, appointmentId, encounterId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', state: 'FINALIZED' } } as any);
    expect(upsert.mock.calls.map(call => call[0].create.kind)).toEqual(['CLINICAL_SUMMARY', 'CLINICAL_RESULTS']);
  });
  it('does not send when the linked email is not verified', async () => {
    query.mockResolvedValueOnce([{ id: eventId, appointment_id: appointmentId, patient_id: patientId }]).mockResolvedValueOnce([]);
    unary.mockResolvedValueOnce({ found: true, accountId: 'account', patientName: 'Patient' }).mockResolvedValueOnce({ found: false });
    await service.flush();
    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastError: 'EMAIL_NOT_VERIFIED' }) }));
  });
  it('does not send a mismatched patient appointment', async () => {
    query.mockResolvedValueOnce([{ id: eventId, appointment_id: appointmentId, patient_id: patientId }]).mockResolvedValueOnce([]);
    unary.mockResolvedValueOnce({ found: true, accountId: 'account', patientName: 'Patient' }).mockResolvedValueOnce({ found: true, email: 'patient@example.test' }).mockResolvedValueOnce({ appointment: { patientId: 'other' } });
    await service.flush();
    expect(send).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: eventId, status: 'PENDING' } }));
  });
  it('sends clinical information only for the correct patient and encounter', async () => {
    const encounterId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    query.mockResolvedValueOnce([{ id: eventId, kind: 'CLINICAL_SUMMARY', appointment_id: appointmentId, patient_id: patientId, encounter_id: encounterId, occurred_at: new Date('2026-11-09T00:00:00Z') }]).mockResolvedValueOnce([]);
    unary.mockResolvedValueOnce({ found: true, accountId: 'account', patientName: 'Patient' }).mockResolvedValueOnce({ found: true, email: 'patient@example.test' }).mockResolvedValueOnce({ appointment: { patientId, appointmentCode: 'APT-1' } }).mockResolvedValueOnce({ prescriptions: [{ patientId, encounterId, items: [{ medicationName: 'Medicine' }] }] }).mockResolvedValueOnce({ plans: [{ patientId, sourceEncounterId: encounterId, title: 'Plan' }] });
    send.mockResolvedValueOnce({ providerMessageId: 'message-1' });
    await service.flush();
    expect(send).toHaveBeenCalledWith('patient@example.test', expect.objectContaining({ html: expect.stringContaining('Medicine') }), expect.any(String));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }));
  });
  it('does not send an empty results email when no file existed at finalization', async () => {
    query.mockResolvedValueOnce([{ id: eventId, kind: 'CLINICAL_RESULTS', appointment_id: appointmentId, patient_id: patientId, encounter_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', occurred_at: new Date('2026-11-09T00:00:00Z') }]).mockResolvedValueOnce([]);
    unary.mockResolvedValueOnce({ found: true, accountId: 'account', patientName: 'Patient' }).mockResolvedValueOnce({ found: true, email: 'patient@example.test' }).mockResolvedValueOnce({ appointment: { patientId, appointmentCode: 'APT-1' } }).mockResolvedValueOnce({ files: [] });
    await service.flush();
    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUPPRESSED', lastError: 'NO_RESULTS_AT_FINALIZATION' }) }));
  });
  it('attaches the results returned for the finalized encounter', async () => {
    const encounterId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    query.mockResolvedValueOnce([{ id: eventId, kind: 'CLINICAL_RESULTS', appointment_id: appointmentId, patient_id: patientId, encounter_id: encounterId, occurred_at: new Date('2026-11-09T00:00:00Z') }]).mockResolvedValueOnce([]);
    unary.mockResolvedValueOnce({ found: true, accountId: 'account', patientName: 'Patient' }).mockResolvedValueOnce({ found: true, email: 'patient@example.test' }).mockResolvedValueOnce({ appointment: { patientId, appointmentCode: 'APT-1' } }).mockResolvedValueOnce({ files: [{ fileName: 'result.pdf', mediaType: 'application/pdf', content: Buffer.from('%PDF-test') }] });
    send.mockResolvedValueOnce({ providerMessageId: 'message-2' });
    await service.flush();
    expect(send).toHaveBeenCalledWith('patient@example.test', expect.any(Object), expect.any(String), [{ fileName: 'result.pdf', mediaType: 'application/pdf', content: Buffer.from('%PDF-test') }]);
    expect(unary).toHaveBeenCalledWith(expect.anything(), 'getClinicalFilesForEmail', expect.objectContaining({ encounterId, patientId }), expect.anything());
  });
});
