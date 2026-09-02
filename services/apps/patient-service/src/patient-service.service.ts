import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PatientDatabaseService } from './database/patient-database.service';

export interface PatientServiceHealthResponse {
  status: 'ok';
  service: 'patient-service';
}

@Injectable()
export class PatientServiceService {
  constructor(private readonly database: PatientDatabaseService) {}

  getHealth(): PatientServiceHealthResponse {
    return { status: 'ok', service: 'patient-service' };
  }

  async getReadiness(): Promise<PatientServiceHealthResponse> {
    try {
      await this.database.$queryRawUnsafe('SELECT 1');
      return this.getHealth();
    } catch {
      throw new ServiceUnavailableException('Patient database is unavailable');
    }
  }
}
