import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { PatientsService } from './patients.service';

@Controller('internal/patients')
@UseGuards(InternalAuthGuard)
export class InternalPatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get(':patientId/eligibility')
  async eligibility(@Param('patientId') patientId: string) {
    return { data: await this.patients.getEligibility(patientId) };
  }
}
