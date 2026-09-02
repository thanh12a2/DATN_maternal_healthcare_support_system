import { Controller, Get } from '@nestjs/common';
import { PatientServiceService } from './patient-service.service';
import type { PatientServiceHealthResponse } from './patient-service.service';

@Controller()
export class PatientServiceController {
  constructor(private readonly patientService: PatientServiceService) {}

  @Get('health')
  getHealth(): PatientServiceHealthResponse {
    return this.patientService.getHealth();
  }

  @Get('ready')
  getReadiness(): Promise<PatientServiceHealthResponse> {
    return this.patientService.getReadiness();
  }
}
