import { Controller, Get } from '@nestjs/common';
import { ReceptionistServiceService } from './receptionist-service.service';

@Controller()
export class ReceptionistServiceController {
  constructor(
    private readonly receptionistServiceService: ReceptionistServiceService,
  ) {}

  @Get('health')
  getHealth(): { status: 'ok' } {
    return this.receptionistServiceService.getHealth();
  }
}
