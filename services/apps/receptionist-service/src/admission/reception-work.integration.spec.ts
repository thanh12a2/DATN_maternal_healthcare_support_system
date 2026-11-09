import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../../generated/receptionist-client';
import { AdmissionService } from './admission.service';
import { ReceptionWorkService } from './reception-work.service';
import { PaymentCompletedConsumer } from './payment-completed.consumer';

const enabled = process.env.RECEPTION_WORK_INTEGRATION === '1';
(enabled ? describe : describe.skip)('reception work on PostgreSQL', () => {
  let db: PrismaClient;
  const alice = { userId: randomUUID(), role: 'RECEPTIONIST' } as any;
  const bob = { userId: randomUUID(), role: 'RECEPTIONIST' } as any;
  beforeAll(async () => {
    if (!process.env.RECEPTIONIST_DATABASE_URL?.includes('/codex_reception_work_test')) throw new Error('Isolated database required');
    db = new PrismaClient(); await db.$connect();
  });
  afterAll(async () => { await db?.$disconnect(); });

  it('keeps a claim after its old expiry until the owner releases it', async () => {
    const item = await db.receptionCase.create({ data: { appointmentId: randomUUID(), patientId: randomUUID(), arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId, workClaimedBy: alice.userId, workClaimExpiresAt: new Date(0) } });
    const work = new ReceptionWorkService(db as any);
    await expect(work.claim(item.id, bob)).rejects.toThrow();
    await expect(work.release(item.id, bob)).rejects.toThrow();
    await work.release(item.id, alice);
    await work.claim(item.id, bob);
    expect((await db.receptionCase.findUniqueOrThrow({ where: { id: item.id } })).workClaimedBy).toBe(bob.userId);
  });

  it('retains the owner while payment is pending and rejects another receptionist', async () => {
    const item = await db.receptionCase.create({ data: { appointmentId: randomUUID(), patientId: randomUUID(), status: 'IDENTITY_VERIFIED', arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId, workClaimedBy: alice.userId } });
    const remote = {
      getAppointment: jest.fn().mockResolvedValue({ appointment: {} }),
      validateAppointment: jest.fn().mockResolvedValue({ valid: true }),
      createInvoice: jest.fn().mockResolvedValue({ invoice: { id: randomUUID() } }),
      paymentCondition: jest.fn().mockResolvedValue({ condition: 'NOT_SATISFIED' }),
    };
    const work = new ReceptionWorkService(db as any);
    const admission = new AdmissionService(db as any, remote as any, work);
    await admission.admit(item.id, alice);
    const current = await db.receptionCase.findUniqueOrThrow({ where: { id: item.id }, include: { admission: true } });
    expect(current.workClaimedBy).toBe(alice.userId);
    expect(current.workRunningToken).toBeNull();
    expect(current.admission?.status).toBe('AWAITING_PAYMENT');
    await expect(work.claim(item.id, bob)).rejects.toThrow();
    await expect(admission.admit(item.id, bob)).rejects.toThrow();
  });

  it('finishes a paid case once and displays its queue ticket only to the owner', async () => {
    const appointmentId = randomUUID(), patientId = randomUUID(), invoiceId = randomUUID();
    const item = await db.receptionCase.create({ data: { appointmentId, patientId, status: 'ADMISSION_IN_PROGRESS', arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId, workClaimedBy: alice.userId } });
    await db.admission.create({ data: { receptionCaseId: item.id, invoiceId, status: 'AWAITING_PAYMENT' } });
    const remote = {
      getAppointment: jest.fn().mockResolvedValue({ appointment: {} }),
      validateAppointment: jest.fn().mockResolvedValue({ valid: true }),
      createInvoice: jest.fn().mockResolvedValue({ invoice: { id: invoiceId } }),
      paymentCondition: jest.fn().mockResolvedValue({ condition: 'PAID' }),
      openEncounter: jest.fn().mockResolvedValue({ encounter: { encounterId: randomUUID() } }),
      checkIn: jest.fn().mockResolvedValue({ appointment: {} }),
      createQueue: jest.fn().mockResolvedValue({ journey: { journeyId: randomUUID() }, initialTicket: { ticketId: randomUUID(), ticketCode: 'A-05', roomCode: '201' } }),
    };
    const work = new ReceptionWorkService(db as any);
    const consumer = new PaymentCompletedConsumer(db as any, {} as any, {} as any, new AdmissionService(db as any, remote as any, work));
    const event = { eventId: randomUUID(), eventType: 'billing.payment_recorded.v1', eventVersion: 1, data: { appointmentId, patientId, invoiceId, status: 'PAID' } } as any;
    await consumer.consume(event);
    await consumer.consume(event);
    expect(remote.createQueue).toHaveBeenCalledTimes(1);
    expect((await work.list(alice)).items.find(row => row.id === item.id)).toEqual(expect.objectContaining({ status: 'ADMITTED', queueTicketCode: 'A-05' }));
    expect((await work.list(bob)).items.find(row => row.id === item.id)).toBeUndefined();
  });

  it('allows an administrator to release an idle case for handover', async () => {
    const item = await db.receptionCase.create({ data: { appointmentId: randomUUID(), patientId: randomUUID(), arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId, workClaimedBy: alice.userId } });
    const work = new ReceptionWorkService(db as any);
    await work.release(item.id, { userId: randomUUID(), role: 'ADMIN' } as any);
    await work.claim(item.id, bob);
    expect((await db.receptionCase.findUniqueOrThrow({ where: { id: item.id } })).workClaimedBy).toBe(bob.userId);
  });

  it('blocks handover and competing mutations until the owner operation finishes', async () => {
    const appointmentId = randomUUID();
    const item = await db.receptionCase.create({ data: { appointmentId, patientId: randomUUID(), arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId, workClaimedBy: alice.userId } });
    const work = new ReceptionWorkService(db as any);
    const acquired = await work.beginOperation(appointmentId, alice.userId);
    expect(acquired.allowed).toBe(true);
    expect(acquired.token).toBeTruthy();
    expect((await work.beginOperation(appointmentId, bob.userId)).allowed).toBe(false);
    await expect(work.release(item.id, alice)).rejects.toThrow();
    await expect(work.release(item.id, { userId: randomUUID(), role: 'ADMIN' } as any)).rejects.toThrow();
    await work.endOperation(acquired.token);
    await work.release(item.id, alice);
    await work.claim(item.id, bob);
    expect((await work.beginOperation(appointmentId, alice.userId)).allowed).toBe(false);
  });

  it('blocks recording arrival while an operation started before the case exists', async () => {
    const appointmentId = randomUUID();
    const patientId = randomUUID();
    const work = new ReceptionWorkService(db as any);
    const operation = await work.beginOperation(appointmentId, alice.userId);
    expect(operation).toEqual(expect.objectContaining({ allowed: true, hasActiveCase: false }));
    const remote = {
      validateAppointment: jest.fn().mockResolvedValue({ valid: true, startAt: { seconds: '1800000000' } }),
      patientIdentity: jest.fn().mockResolvedValue({ patient: {} }),
      getAppointment: jest.fn().mockResolvedValue({ appointment: {} }),
    };
    const admission = new AdmissionService(db as any, remote as any, work);
    await expect(admission.openCase({ appointmentId, patientId }, bob)).rejects.toThrow('Lịch hẹn đang được xử lý');
    await work.endOperation(operation.token);
    await expect(admission.openCase({ appointmentId, patientId }, bob)).resolves.toEqual(expect.objectContaining({ workClaimedBy: bob.userId }));
  });

  it('does not allow arrival and a different receptionist operation to win the same race', async () => {
    const appointmentId = randomUUID();
    const work = new ReceptionWorkService(db as any);
    const remote = { validateAppointment: jest.fn().mockResolvedValue({ valid: true, startAt: { seconds: '1800000000' } }), patientIdentity: jest.fn().mockResolvedValue({ patient: {} }), getAppointment: jest.fn().mockResolvedValue({ appointment: {} }) };
    const admission = new AdmissionService(db as any, remote as any, work);
    const [operation, arrival] = await Promise.allSettled([work.beginOperation(appointmentId, alice.userId), admission.openCase({ appointmentId, patientId: randomUUID() }, bob)]);
    const operationWon = operation.status === 'fulfilled' && operation.value.allowed;
    const arrivalWon = arrival.status === 'fulfilled';
    expect(Number(operationWon) + Number(arrivalWon)).toBe(1);
    if (operation.status === 'fulfilled' && operation.value.token) await work.endOperation(operation.value.token);
  });

  it('only permits the claimant to verify identity', async () => {
    const item = await db.receptionCase.create({ data: { appointmentId: randomUUID(), patientId: randomUUID(), arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId } });
    const work = new ReceptionWorkService(db as any);
    const admission = new AdmissionService(db as any, {} as any, work);
    const attempts = await Promise.allSettled([work.claim(item.id, alice), work.claim(item.id, bob)]);
    expect(attempts.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const winner = attempts[0].status === 'fulfilled' ? alice : bob;
    const loser = winner === alice ? bob : alice;
    const input = { method: 'APPOINTMENT_CODE', result: 'VERIFIED' };
    await expect(admission.verify(item.id, input, loser)).rejects.toThrow();
    await admission.verify(item.id, input, winner);
    expect((await db.receptionCase.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('IDENTITY_VERIFIED');
  });

  it('blocks a second admit while the first is calling dependencies', async () => {
    const item = await db.receptionCase.create({ data: { appointmentId: randomUUID(), patientId: randomUUID(), status: 'IDENTITY_VERIFIED', arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId } });
    const work = new ReceptionWorkService(db as any);
    await work.claim(item.id, alice);
    let resume!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { resume = resolve; });
    const waiting = new Promise<void>(resolve => { started = resolve; });
    const remote = {
      validateAppointment: jest.fn(async () => { started(); await gate; return { valid: true }; }),
      getAppointment: jest.fn().mockResolvedValue({ appointment: {} }),
      createInvoice: jest.fn().mockResolvedValue({ invoice: { id: randomUUID() } }),
      paymentCondition: jest.fn().mockResolvedValue({ condition: 'PAID' }),
      openEncounter: jest.fn().mockResolvedValue({ encounter: { encounterId: randomUUID() } }),
      checkIn: jest.fn().mockResolvedValue({ appointment: {} }),
      createQueue: jest.fn().mockResolvedValue({ journey: { journeyId: randomUUID() }, initialTicket: { ticketId: randomUUID(), ticketCode: 'Q-05', roomCode: '201' } }),
    };
    const service = new AdmissionService(db as any, remote as any, work);
    const first = service.admit(item.id, alice);
    await waiting;
    await expect(service.admit(item.id, alice)).rejects.toThrow();
    await expect(work.claim(item.id, bob)).rejects.toThrow();
    resume();
    await first;
    expect((await db.receptionCase.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('ADMITTED');
    const notice = (await work.list(alice)).items.find(row => row.id === item.id);
    expect(notice).toEqual(expect.objectContaining({ queueTicketCode: 'Q-05', queueRoomCode: '201' }));
    expect((await work.list(bob)).items.find(row => row.id === item.id)).toBeUndefined();
    await expect(work.dismiss(item.id, bob)).rejects.toThrow();
    await work.dismiss(item.id, alice);
    expect((await work.list(alice)).items.find(row => row.id === item.id)).toBeUndefined();
  });

  it('continues from an already checked-in appointment after queue creation failed', async () => {
    const item = await db.receptionCase.create({ data: { appointmentId: randomUUID(), patientId: randomUUID(), status: 'ADMISSION_IN_PROGRESS', arrivalAt: new Date(), openedByAccountId: alice.userId, lastHandledByAccountId: alice.userId } });
    const encounterId = randomUUID();
    await db.admission.create({ data: { receptionCaseId: item.id, status: 'FAILED_RETRYABLE', currentStep: 'CREATE_AUTHORITATIVE_QUEUE_TICKET', invoiceId: randomUUID(), encounterId, appointmentCheckedInAt: new Date() } });
    const work = new ReceptionWorkService(db as any);
    await work.claim(item.id, bob);
    const remote = {
      getAppointment: jest.fn().mockResolvedValue({ appointment: { status: 'APPOINTMENT_STATUS_CHECKED_IN', patientId: item.patientId, receptionCaseId: item.id, encounterId } }),
      validateAppointment: jest.fn(), paymentCondition: jest.fn().mockResolvedValue({ condition: 'PAID' }),
      createQueue: jest.fn().mockResolvedValue({ journey: { journeyId: randomUUID() }, initialTicket: { ticketId: randomUUID() } }),
    };
    const service = new AdmissionService(db as any, remote as any, work);
    await service.admit(item.id, bob);
    expect(remote.validateAppointment).not.toHaveBeenCalled();
    expect(remote.createQueue).toHaveBeenCalledTimes(1);
    expect((await db.receptionCase.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('ADMITTED');
  });
});
