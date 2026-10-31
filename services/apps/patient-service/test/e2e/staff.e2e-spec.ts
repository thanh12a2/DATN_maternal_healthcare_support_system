import '../setup-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/patient-client';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { configurePatientApp } from '../../src/app-bootstrap';
import { PatientDatabaseService } from '../../src/database/patient-database.service';
import { PatientServiceModule } from '../../src/patient-service.module';

const db = new PrismaClient({ datasourceUrl: process.env.PATIENT_DATABASE_URL });
let app: INestApplication;
const userToken = (role: string, subject = randomUUID()) => sign(
  { role },
  (globalThis as Record<string, string>).__E2E_PRIVATE_KEY__,
  {
    algorithm: 'RS256', issuer: 'maternal-healthcare-auth', audience: 'maternal-healthcare-api',
    subject, jwtid: randomUUID(), keyid: 'test-key', expiresIn: '5m',
  },
);
const internalToken = (scope = 'patient:eligibility:read') => sign(
  { scope },
  (globalThis as Record<string, string>).__E2E_PRIVATE_KEY__,
  {
    algorithm: 'RS256', issuer: 'maternal-healthcare-internal', audience: 'patient-service',
    subject: 'appointment-service', jwtid: randomUUID(), keyid: 'test-key', expiresIn: '5m',
  },
);

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [PatientServiceModule] })
    .overrideProvider(PatientDatabaseService).useValue(db).compile();
  app = moduleRef.createNestApplication();
  configurePatientApp(app);
  await app.init();
});
beforeEach(async () => {
  await db.idempotencyRecord.deleteMany();
  await db.patientAuditLog.deleteMany();
  await db.emergencyContact.deleteMany();
  await db.patient.deleteMany();
});
afterAll(async () => { await app.close(); await db.$disconnect(); });

describe('Receptionist and internal HTTP E2E', () => {
  it('runs create retry, detail, search, patch and enforces role separation', async () => {
    const auth = 'Bearer ' + userToken('RECEPTIONIST');
    const key = randomUUID();
    const payload = {
      fullName: 'Nguyễn Thị A', dateOfBirth: '1995-06-15', phoneNumber: '0901234567',
      nationalId: '012345678901', address: 'HCM', reason: 'CHECK_IN',
    };
    const created = await request(app.getHttpServer()).post('/patients')
      .set('Authorization', auth).set('Idempotency-Key', key).send(payload);
    expect(created.status).toBe(201);
    const retry = await request(app.getHttpServer()).post('/patients')
      .set('Authorization', auth).set('Idempotency-Key', key).send(payload);
    expect(retry.status).toBe(200);
    const detail = await request(app.getHttpServer()).get('/patients/' + created.body.data.id)
      .set('Authorization', auth);
    expect(detail.status).toBe(200);
    const search = await request(app.getHttpServer()).post('/patients/search')
      .set('Authorization', auth).send({ phoneNumber: '0901 234 567' });
    expect(search.status).toBe(200);
    expect(search.body.data.items[0]).not.toHaveProperty('address');
    const patched = await request(app.getHttpServer()).patch('/patients/' + created.body.data.id)
      .set('Authorization', auth).send({ address: 'Q1', version: 1, reason: 'CORRECTION' });
    expect(patched.status).toBe(200);
    const patientAuth = 'Bearer ' + userToken('PATIENT');
    expect((await request(app.getHttpServer()).get('/patients/' + created.body.data.id).set('Authorization', patientAuth)).status).toBe(403);
  });

  it('authenticates internal eligibility and exposes only minimal fields', async () => {
    const auth = 'Bearer ' + userToken('RECEPTIONIST');
    const created = await request(app.getHttpServer()).post('/patients')
      .set('Authorization', auth).set('Idempotency-Key', randomUUID()).send({
        fullName: 'Nguyễn Thị A', dateOfBirth: '1995-06-15', phoneNumber: '0901234567', reason: 'CHECK_IN',
      });
    const endpoint = '/internal/patients/' + created.body.data.id + '/eligibility';
    expect((await request(app.getHttpServer()).get(endpoint)).status).toBe(401);
    expect((await request(app.getHttpServer()).get(endpoint).set('Authorization', 'Bearer ' + internalToken('wrong'))).status).toBe(401);
    const eligible = await request(app.getHttpServer()).get(endpoint)
      .set('Authorization', 'Bearer ' + internalToken());
    expect(eligible.status).toBe(200);
    expect(eligible.body.data).toEqual({
      patientId: created.body.data.id, exists: true, profileStatus: 'COMPLETE',
      eligibleForBooking: true, missingFields: [],
    });
  });
});
