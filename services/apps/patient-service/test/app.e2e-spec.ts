import './setup-env';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/patient-client';
import { configurePatientApp } from '../src/app-bootstrap';
import { PatientDatabaseService } from '../src/database/patient-database.service';
import { PatientServiceModule } from '../src/patient-service.module';
let app: INestApplication;
const db = new PrismaClient({
  datasourceUrl: process.env.PATIENT_DATABASE_URL,
});
const account = randomUUID();
const token = () =>
  sign({ role: 'PATIENT' }, (globalThis as any).__E2E_PRIVATE_KEY__, {
    algorithm: 'RS256',
    issuer: 'maternal-healthcare-auth',
    audience: 'maternal-healthcare-api',
    subject: account,
    jwtid: randomUUID(),
    keyid: 'test-key',
    expiresIn: '5m',
  });
beforeAll(async () => {
  const m = await Test.createTestingModule({ imports: [PatientServiceModule] })
    .overrideProvider(PatientDatabaseService)
    .useValue(db)
    .compile();
  app = m.createNestApplication();
  configurePatientApp(app);
  await app.init();
});
beforeEach(async () => {
  await db.patientAuditLog.deleteMany();
  await db.emergencyContact.deleteMany();
  await db.patient.deleteMany();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});
describe('Patient Service E2E', () => {
  it('health', () =>
    request(app.getHttpServer())
      .get('/health')
      .expect(200, { status: 'ok', service: 'patient-service' }));
  it('runs create/read/update/retry and contacts over HTTP with real PostgreSQL', async () => {
    const auth = 'Bearer ' + token(),
      payload = {
        fullName: 'Nguyễn Thị A',
        dateOfBirth: '1995-06-15',
        phoneNumber: '0901234567',
        nationalId: '012345678901',
        address: 'HCM',
      };
    const created = await request(app.getHttpServer())
      .put('/patients/me')
      .set('Authorization', auth)
      .send(payload);
    expect(created.status).toBe(201);
    expect(created.body.data.nationalIdMasked).toBe('********8901');
    const retry = await request(app.getHttpServer())
      .put('/patients/me')
      .set('Authorization', auth)
      .send(payload);
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(created.body.data.id);
    const read = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', auth);
    expect(read.status).toBe(200);
    const update = await request(app.getHttpServer())
      .put('/patients/me')
      .set('Authorization', auth)
      .send({ ...payload, address: 'Quận 1', version: 1 });
    expect(update.status).toBe(200);
    expect(update.body.data.version).toBe(2);
    const contact = await request(app.getHttpServer())
      .post('/patients/' + created.body.data.id + '/emergency-contacts')
      .set('Authorization', auth)
      .send({
        fullName: 'Nguyễn Văn B',
        relationship: 'Chồng',
        phoneNumber: '0912345678',
        isPrimary: true,
      });
    expect(contact.status).toBe(201);
    expect(contact.body.data.isPrimary).toBe(true);
    expect((await db.patient.count()).valueOf()).toBe(1);
  });
  it('rejects future DOB and arbitrary patient access', async () => {
    const auth = 'Bearer ' + token();
    const invalid = await request(app.getHttpServer())
      .put('/patients/me')
      .set('Authorization', auth)
      .send({
        fullName: 'Nguyễn Thị A',
        dateOfBirth: '2999-01-01',
        phoneNumber: '0901234567',
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_DATE_OF_BIRTH');
    expect(
      (
        await request(app.getHttpServer())
          .get('/patients/' + randomUUID())
          .set('Authorization', auth)
      ).status,
    ).toBe(403);
  });
});
