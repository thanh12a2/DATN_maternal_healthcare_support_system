import './setup-env';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { configurePatientApp } from '../../src/app-bootstrap';
import { PatientDatabaseService } from '../../src/database/patient-database.service';
import { PatientServiceModule } from '../../src/patient-service.module';
import { PatientsService } from '../../src/patients/patients.service';

let app: INestApplication;
const patientId = randomUUID();
const responsePatient = {
  id: patientId, fullName: 'Nguyễn Thị A', dateOfBirth: '1995-06-15',
  phoneNumber: '+84901234567', nationalIdMasked: null, address: null,
  profileStatus: 'COMPLETE', version: 1, emergencyContacts: [],
};
const patients = {
  createByReceptionist: jest.fn(async () => ({ created: true, data: responsePatient })),
  search: jest.fn(async () => ({ items: [], page: 1, limit: 20, total: 0 })),
  getById: jest.fn(async (_id: string, auth: { role: string }) => {
    if (auth.role !== 'RECEPTIONIST') throw new ForbiddenException();
    return responsePatient;
  }),
  patchByReceptionist: jest.fn(async () => ({ ...responsePatient, version: 2 })),
  getEligibility: jest.fn(async (id: string) => ({
    patientId: id, exists: true, profileStatus: 'COMPLETE', eligibleForBooking: true, missingFields: [],
  })),
};
const token = (role: string, internal = false) => sign(
  internal ? { scope: 'patient:eligibility:read' } : { role },
  (globalThis as Record<string, string>).__API_PRIVATE_KEY__,
  {
    algorithm: 'RS256',
    issuer: internal ? 'maternal-healthcare-internal' : 'maternal-healthcare-auth',
    audience: internal ? 'patient-service' : 'maternal-healthcare-api',
    subject: internal ? 'appointment-service' : randomUUID(),
    jwtid: randomUUID(), keyid: 'test-key', expiresIn: '5m',
  },
);

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [PatientServiceModule] })
    .overrideProvider(PatientDatabaseService).useValue({ $disconnect: jest.fn(), $queryRawUnsafe: jest.fn() })
    .overrideProvider(PatientsService).useValue(patients)
    .compile();
  app = moduleRef.createNestApplication();
  configurePatientApp(app);
  await app.init();
});
afterAll(async () => app.close());

describe('Receptionist/internal API contract', () => {
  it('creates at reception and returns 201', async () => {
    const result = await request(app.getHttpServer()).post('/patients')
      .set('Authorization', 'Bearer ' + token('RECEPTIONIST'))
      .set('Idempotency-Key', randomUUID())
      .send({ fullName: 'Nguyễn Thị A', dateOfBirth: '1995-06-15', phoneNumber: '0901234567', reason: 'CHECK_IN' });
    expect(result.status).toBe(201);
    expect(result.body.data.id).toBe(patientId);
  });
  it('searches with HTTP 200 and validates filter DTO', async () => {
    const auth = 'Bearer ' + token('RECEPTIONIST');
    expect((await request(app.getHttpServer()).post('/patients/search').set('Authorization', auth).send({ phoneNumber: '0901234567' })).status).toBe(200);
    expect((await request(app.getHttpServer()).post('/patients/search').set('Authorization', auth).send({ limit: 51 })).status).toBe(400);
  });
  it('serves receptionist detail/update and blocks PATIENT arbitrary detail', async () => {
    const receptionist = 'Bearer ' + token('RECEPTIONIST');
    expect((await request(app.getHttpServer()).get('/patients/' + patientId).set('Authorization', receptionist)).status).toBe(200);
    expect((await request(app.getHttpServer()).patch('/patients/' + patientId).set('Authorization', receptionist).send({ address: 'Q1', version: 1, reason: 'CORRECTION' })).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/patients/' + patientId).set('Authorization', 'Bearer ' + token('PATIENT'))).status).toBe(403);
  });
  it('requires dedicated internal token for eligibility', async () => {
    const path = '/internal/patients/' + patientId + '/eligibility';
    expect((await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer ' + token('RECEPTIONIST'))).status).toBe(401);
    const result = await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer ' + token('', true));
    expect(result.status).toBe(200);
    expect(result.body.data).not.toHaveProperty('phoneNumber');
  });
});
