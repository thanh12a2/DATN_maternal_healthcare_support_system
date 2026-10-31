import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/patient-client';
import { PatientsService } from '../../src/patients/patients.service';
import { NationalIdCryptoService } from '../../src/security/national-id-crypto.service';

const db = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:password@localhost:55433/patient_test?schema=public',
});
const crypto = new NationalIdCryptoService({
  get: (key: string) => key === 'PATIENT_NATIONAL_ID_ENCRYPTION_KEY'
    ? '11'.repeat(32)
    : 'a-strong-test-pepper-value',
} as ConfigService);
const service = new PatientsService(db as never, crypto);
const receptionist = () => ({
  userId: randomUUID(),
  role: 'RECEPTIONIST' as const,
  tokenId: randomUUID(),
});
const createDto = (extra: Record<string, unknown> = {}) => ({
  fullName: 'Nguyễn Thị A',
  dateOfBirth: '1995-06-15',
  phoneNumber: '0901234567',
  nationalId: '012345678901',
  address: 'HCM',
  reason: 'CHECK_IN',
  ...extra,
});

beforeAll(() => db.$connect());
beforeEach(async () => {
  await db.idempotencyRecord.deleteMany();
  await db.patientAuditLog.deleteMany();
  await db.emergencyContact.deleteMany();
  await db.patient.deleteMany();
});
afterAll(() => db.$disconnect());

describe('Receptionist and internal PostgreSQL integration', () => {
  it('creates idempotently, searches masked data and audits result', async () => {
    const actor = receptionist();
    const key = randomUUID();
    const first = await service.createByReceptionist(createDto(), key, actor, randomUUID());
    const retry = await service.createByReceptionist(createDto(), key, actor, randomUUID());
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.data.id).toBe(first.data.id);
    await expect(
      service.createByReceptionist(createDto({ address: 'Other' }), key, actor, randomUUID()),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    const result = await service.search(
      { phoneNumber: '0901 234 567', page: 1, limit: 20 },
      actor,
      randomUUID(),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: first.data.id,
      nationalIdMasked: '********8901',
    }));
    expect(result.items[0]).not.toHaveProperty('address');
    expect(await db.patientAuditLog.count({ where: { eventType: 'patient.searched' } })).toBe(1);
  });

  it('prevents stale staff updates and rolls back when audit insert fails', async () => {
    const actor = receptionist();
    const created = await service.createByReceptionist(createDto(), randomUUID(), actor, randomUUID());
    const changed = await service.patchByReceptionist(
      created.data.id,
      { address: 'Q1', version: 1, reason: 'CORRECTION' },
      actor,
      randomUUID(),
    );
    expect(changed.version).toBe(2);
    const updateAudit = await db.patientAuditLog.findFirstOrThrow({
      where: { eventType: 'patient.updated', patientId: created.data.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(updateAudit.metadata).toEqual({ reason: 'CORRECTION' });
    await expect(
      service.patchByReceptionist(
        created.data.id,
        { address: 'stale', version: 1, reason: 'CORRECTION' },
        actor,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });

    const before = await db.patient.findUniqueOrThrow({ where: { id: created.data.id } });
    const original = db.patientAuditLog.create.bind(db.patientAuditLog);
    const failingDb = new Proxy(db, {
      get(target, property) {
        if (property === '$transaction') {
          return (callback: (transaction: unknown) => unknown) => target.$transaction((transaction) =>
            callback(new Proxy(transaction, {
              get(tx, key) {
                if (key === 'patientAuditLog') return { create: () => { throw new Error('audit unavailable'); } };
                return Reflect.get(tx, key);
              },
            })),
          );
        }
        return Reflect.get(target, property);
      },
    });
    const failingService = new PatientsService(failingDb as never, crypto);
    await expect(
      failingService.patchByReceptionist(
        created.data.id,
        { fullName: 'Changed Name', version: 2, reason: 'CORRECTION' },
        actor,
        randomUUID(),
      ),
    ).rejects.toThrow('audit unavailable');
    const after = await db.patient.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(after.fullName).toBe(before.fullName);
    expect(db.patientAuditLog.create.bind(db.patientAuditLog)).toBeDefined();
    expect(original).toBeDefined();
  });

  it('returns eligibility without PII for existing and missing patients', async () => {
    const actor = receptionist();
    const patient = await service.createByReceptionist(createDto(), randomUUID(), actor, randomUUID());
    const existing = await service.getEligibility(patient.data.id);
    const missing = await service.getEligibility(randomUUID());
    expect(existing).toEqual({
      patientId: patient.data.id,
      exists: true,
      profileStatus: 'COMPLETE',
      eligibleForBooking: true,
      missingFields: [],
    });
    expect(existing).not.toHaveProperty('phoneNumber');
    expect(missing.exists).toBe(false);
  });
});
