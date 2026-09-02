import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ReceptionistServiceModule } from './../src/receptionist-service.module';

describe('ReceptionistServiceController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ReceptionistServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('does not expose Auth-blocked receptionist provisioning', () => {
    return request(app.getHttpServer())
      .post('/receptionists')
      .send({})
      .expect(404);
  });

  it('does not expose downstream-blocked Admission routes', () => {
    return request(app.getHttpServer())
      .post('/reception/cases')
      .send({})
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
