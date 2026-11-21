import { BadRequestException, Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes, timestampToDate } from '@platform';
import { ClinicalResultsService } from './clinical-results.service';

@Controller()
@UseGuards(ServiceJwtGuard)
export class ClinicalResultsGrpcController {
  constructor(private readonly results: ClinicalResultsService) {}
  @GrpcMethod('DocumentInternalService', 'GetClinicalFilesForEmail')
  @ServiceCallers('notification-service') @ServiceScopes('document:clinical-email:read')
  files(r: { encounterId: string; patientId: string; cutoff: { seconds: string; nanos: number } }) {
    const cutoff = timestampToDate(r.cutoff);
    if (!cutoff) throw new BadRequestException('INVALID_CUTOFF');
    return this.results.filesForEmail(r.encounterId, r.patientId, cutoff);
  }
}
