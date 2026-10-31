import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes } from '@platform';
import { MedicalDomainService } from './medical.service';
@Controller()
@UseGuards(ServiceJwtGuard)
export class MedicalGrpcController {
  constructor(private readonly s: MedicalDomainService) {}
  @GrpcMethod('MedicalRecordInternalService', 'OpenOrGetEncounter')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('medical:encounter:open')
  open(r: any) {
    return this.s.open(r);
  }
  @GrpcMethod('MedicalRecordInternalService', 'GetEncounterSummary')
  @ServiceCallers(
    'receptionist-service',
    'queue-service',
    'document-service',
    'prescription-service',
    'treatment-plan-service',
  )
  @ServiceScopes('medical:encounter:read')
  async summary(r: any) {
    return this.s.summaryBy(
      r.encounterId || undefined,
      r.appointmentId || undefined,
    );
  }
  @GrpcMethod('MedicalRecordInternalService', 'ValidateEncounterAccess')
  @ServiceCallers(
    'document-service',
    'prescription-service',
    'treatment-plan-service',
    'consultation-service',
  )
  @ServiceScopes('medical:access:validate')
  validate(r: any) {
    return this.s.validate(r);
  }
  @GrpcMethod('MedicalRecordInternalService', 'LinkExternalClinicalResource')
  @ServiceCallers(
    'document-service',
    'prescription-service',
    'treatment-plan-service',
  )
  @ServiceScopes('medical:resource:link')
  link(r: any) {
    return this.s.link(r);
  }
  @GrpcMethod('MedicalRecordInternalService', 'GetPregnancyEpisodeContext')
  @ServiceCallers('prescription-service', 'treatment-plan-service')
  @ServiceScopes('medical:pregnancy:read')
  pregnancy(r: any) {
    return this.s.pregnancy(r.patientId, r.pregnancyEpisodeId || undefined);
  }
}
