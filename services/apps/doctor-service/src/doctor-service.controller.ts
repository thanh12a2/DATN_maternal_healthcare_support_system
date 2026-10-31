import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { DoctorServiceService } from './doctor-service.service';
import type { HealthCheckResponse } from './doctor-service.service';

@Controller()
export class DoctorServiceController {
  constructor(private readonly service: DoctorServiceService) {}

  @Public()
  @Get('health')
  health(): Promise<HealthCheckResponse> {
    return this.service.getHealth();
  }
}
