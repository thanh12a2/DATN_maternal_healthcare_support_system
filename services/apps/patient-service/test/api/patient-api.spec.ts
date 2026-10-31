import './setup-env';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { configurePatientApp } from '../../src/app-bootstrap';
import { PatientDatabaseService } from '../../src/database/patient-database.service';
import { PatientServiceModule } from '../../src/patient-service.module';
const account = randomUUID();
let app: INestApplication;
const db: any = {
  $disconnect: jest.fn(),
  patient: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};
const token = (role = 'PATIENT') =>
  sign({ role }, (globalThis as any).__API_PRIVATE_KEY__, {
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
afterAll(async () => {
  if (app) await app.close();
});
describe('Patient API contract', () => {
  it('serves public liveness', () =>
    request(app.getHttpServer())
      .get('/health')
      .expect(200, { status: 'ok', service: 'patient-service' }));
  it('protects /patients/me and rejects wrong role', async () => {
    expect(
      (await request(app.getHttpServer()).get('/patients/me')).body.error.code,
    ).toBe('UNAUTHENTICATED');
    expect(
      (
        await request(app.getHttpServer())
          .get('/patients/me')
          .set('Authorization', 'Bearer ' + token('ADMIN'))
      ).body.error.code,
    ).toBe('FORBIDDEN');
  });
  it('rejects unknown request fields globally', async () => {
    const r = await request(app.getHttpServer())
      .put('/patients/me')
      .set('Authorization', 'Bearer ' + token())
      .send({
        fullName: 'Nguyễn Thị A',
        dateOfBirth: '1995-06-15',
        phoneNumber: '0901234567',
        authAccountId: account,
      });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_FAILED');
  });
  it('returns profile-not-found envelope', async () => {
    db.patient.findUnique.mockResolvedValueOnce(null);
    const r = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', 'Bearer ' + token());
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('PATIENT_PROFILE_NOT_FOUND');
    expect(r.body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('blocks arbitrary-ID read', async () => {
    const r = await request(app.getHttpServer())
      .get('/patients/' + randomUUID())
      .set('Authorization', 'Bearer ' + token());
    expect(r.status).toBe(403);
    expect(r.body).not.toHaveProperty('data');
  });
});
