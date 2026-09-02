import { Controller, Get } from '@nestjs/common';
import { PatientServiceService } from './patient-service.service';
import type { PatientServiceHealthResponse } from './patient-service.service';

@Controller()
export class PatientServiceController {
  constructor(private readonly patientServiceService: PatientServiceService) {}

  @Get('health')
  getHealth(): PatientServiceHealthResponse {
    return this.patientServiceService.getHealth();
  }
}
