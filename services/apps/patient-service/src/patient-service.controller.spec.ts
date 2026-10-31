import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PatientServiceController } from './patient-service.controller';
import { PatientServiceService } from './patient-service.service';
import { PatientDatabaseService } from './database/patient-database.service';

describe('PatientServiceController', () => {
  let patientServiceController: PatientServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PatientServiceController],
      providers: [
        PatientServiceService,
        {
          provide: PatientDatabaseService,
          useValue: { $queryRawUnsafe: jest.fn(async () => [1]) },
        },
      ],
    }).compile();

    patientServiceController = app.get<PatientServiceController>(
      PatientServiceController,
    );
  });

  describe('health', () => {
    it('should return patient-service health status', () => {
      expect(patientServiceController.getHealth()).toEqual({
        status: 'ok',
        service: 'patient-service',
      });
    });

    it('should return readiness when the database responds', async () => {
      await expect(patientServiceController.getReadiness()).resolves.toEqual({
        status: 'ok',
        service: 'patient-service',
      });
    });
  });
});
