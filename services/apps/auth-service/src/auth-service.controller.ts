import { Controller, Get } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import type { HealthCheckResponse } from './auth-service.service';

@Controller()
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}

  @Get()
  getHello(): string {
    return this.authServiceService.getHello();
  }

  @Get('health')
  getHealth(): HealthCheckResponse {
    return this.authServiceService.getHealth();
  }
}
