import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/patient-client';
import { ConfigService } from '@nestjs/config';
import { PatientsService } from '../../src/patients/patients.service';
import { NationalIdCryptoService } from '../../src/security/national-id-crypto.service';
const db = new PrismaClient({
  datasourceUrl:
    'postgresql://postgres:password@localhost:55433/patient_test?schema=public',
});
const crypto = new NationalIdCryptoService({
  get: (k: string) =>
    k === 'PATIENT_NATIONAL_ID_ENCRYPTION_KEY'
      ? '11'.repeat(32)
      : 'a-strong-test-pepper-value',
} as ConfigService);
const service = new PatientsService(db as any, crypto);
const auth = () => ({
  userId: randomUUID(),
  role: 'PATIENT' as const,
  tokenId: randomUUID(),
});
const dto = (extra: any = {}) => ({
  fullName: ' Nguyễn   Thị A ',
  dateOfBirth: '1995-06-15',
  phoneNumber: '0901 234 567',
  nationalId: undefined,
  address: undefined,
  ...extra,
});
beforeAll(() => db.$connect());
beforeEach(async () => {
  await db.patientAuditLog.deleteMany();
  await db.emergencyContact.deleteMany();
  await db.patient.deleteMany();
});
afterAll(() => db.$disconnect());
describe('Patient PostgreSQL integration', () => {
  it('creates, reads, retries, updates and audits atomically', async () => {
    const a = auth(),
      rid = randomUUID();
    const created = await service.upsertMe(
      dto({ nationalId: '012345678901' }),
      a,
      rid,
    );
    expect(created.created).toBe(true);
    expect(created.data.nationalIdMasked).toBe('********8901');
    expect(
      (
        await service.upsertMe(
          dto({ nationalId: '012345678901' }),
          a,
          randomUUID(),
        )
      ).data.id,
    ).toBe(created.data.id);
    expect(await db.patient.count()).toBe(1);
    expect(await db.patientAuditLog.count()).toBe(1);
    const changed = await service.upsertMe(
      dto({ nationalId: '012345678901', address: 'HCM', version: 1 }),
      a,
      randomUUID(),
    );
    expect(changed.data.version).toBe(2);
    expect((await service.getMe(a)).address).toBe('HCM');
    expect(await db.patientAuditLog.count()).toBe(2);
  });
  it('enforces unique account and national ID in real PostgreSQL', async () => {
    const a = auth(),
      b = auth();
    await service.upsertMe(
      dto({ nationalId: '012345678901' }),
      a,
      randomUUID(),
    );
    await expect(
      service.upsertMe(dto({ nationalId: '012 345 678 901' }), b, randomUUID()),
    ).rejects.toMatchObject({ code: 'PATIENT_IDENTITY_CONFLICT' });
    expect(await db.patient.count()).toBe(1);
  });
  it('serializes concurrent profile creation for the same account', async () => {
    const a = auth();
    const results = await Promise.all([
      service.upsertMe(dto(), a, randomUUID()),
      service.upsertMe(dto(), a, randomUUID()),
    ]);
    expect(results.map((result) => result.created).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0].data.id).toBe(results[1].data.id);
    expect(await db.patient.count()).toBe(1);
    expect(
      await db.patientAuditLog.count({
        where: { eventType: 'patient.created' },
      }),
    ).toBe(1);
  });

  it('prevents lost updates', async () => {
    const a = auth();
    await service.upsertMe(dto(), a, randomUUID());
    await service.upsertMe(
      dto({ address: 'first', version: 1 }),
      a,
      randomUUID(),
    );
    await expect(
      service.upsertMe(dto({ address: 'stale', version: 1 }), a, randomUUID()),
    ).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });
    expect((await service.getMe(a)).address).toBe('first');
  });
  it('enforces contact limit, primary switching, ownership and idempotent delete', async () => {
    const a = auth(),
      other = auth();
    const p = (await service.upsertMe(dto(), a, randomUUID())).data;
    const ids = [];
    for (let i = 0; i < 3; i++)
      ids.push(
        (
          await service.addContact(
            p.id,
            {
              fullName: 'Contact ' + i,
              relationship: 'Family',
              phoneNumber: '0901234567',
              isPrimary: i === 0,
            },
            a,
            randomUUID(),
          )
        ).id,
      );
    await expect(
      service.addContact(
        p.id,
        {
          fullName: 'Fourth',
          relationship: 'Family',
          phoneNumber: '0901234567',
        },
        a,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'EMERGENCY_CONTACT_LIMIT_REACHED' });
    await service.updateContact(
      p.id,
      ids[1],
      { isPrimary: true },
      a,
      randomUUID(),
    );
    expect(
      await db.emergencyContact.count({
        where: { patientId: p.id, isPrimary: true },
      }),
    ).toBe(1);
    await expect(
      service.deleteContact(p.id, ids[0], other, randomUUID()),
    ).rejects.toBeDefined();
    const otherPatient = (await service.upsertMe(dto(), other, randomUUID()))
      .data;
    await expect(
      service.deleteContact(otherPatient.id, ids[1], other, randomUUID()),
    ).rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' });
    await service.deleteContact(p.id, ids[0], a, randomUUID());
    await service.deleteContact(p.id, ids[0], a, randomUUID());
    expect(await db.emergencyContact.count()).toBe(2);
  });

  it('serializes concurrent contact additions at the three-contact limit', async () => {
    const a = auth();
    const patient = (await service.upsertMe(dto(), a, randomUUID())).data;
    for (let index = 0; index < 2; index++) {
      await service.addContact(
        patient.id,
        {
          fullName: `Contact ${index}`,
          relationship: 'Mẹ',
          phoneNumber: `090123456${index}`,
        },
        a,
        randomUUID(),
      );
    }
    const results = await Promise.allSettled([
      service.addContact(
        patient.id,
        {
          fullName: 'Contact A',
          relationship: 'Mẹ',
          phoneNumber: '0901234570',
        },
        a,
        randomUUID(),
      ),
      service.addContact(
        patient.id,
        {
          fullName: 'Contact B',
          relationship: 'Mẹ',
          phoneNumber: '0901234571',
        },
        a,
        randomUUID(),
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { code: 'EMERGENCY_CONTACT_LIMIT_REACHED' },
    });
    expect(
      await db.emergencyContact.count({ where: { patientId: patient.id } }),
    ).toBe(3);
  });
});
