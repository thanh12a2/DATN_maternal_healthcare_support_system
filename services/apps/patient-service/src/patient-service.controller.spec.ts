import { beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PatientServiceController } from './patient-service.controller';
import { PatientServiceService } from './patient-service.service';

describe('PatientServiceController', () => {
  let patientServiceController: PatientServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PatientServiceController],
      providers: [PatientServiceService],
    }).compile();

    patientServiceController = app.get<PatientServiceController>(PatientServiceController);
  });

  describe('health', () => {
    it('should return patient-service health status', () => {
      expect(patientServiceController.getHealth()).toEqual({
        status: 'ok',
        service: 'patient-service',
      });
    });
  });
});
