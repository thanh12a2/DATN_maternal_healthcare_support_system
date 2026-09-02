import { Injectable } from '@nestjs/common';

export interface PatientServiceHealthResponse {
  status: 'ok';
  service: 'patient-service';
}

@Injectable()
export class PatientServiceService {
  getHealth(): PatientServiceHealthResponse {
    return {
      status: 'ok',
      service: 'patient-service',
    };
  }
}
