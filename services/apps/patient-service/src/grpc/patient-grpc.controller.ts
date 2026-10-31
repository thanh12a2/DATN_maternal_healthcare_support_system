import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes } from '@platform';
import { PatientsService } from '../patients/patients.service';

@Controller()
@UseGuards(ServiceJwtGuard)
export class PatientGrpcController {
  constructor(private readonly patients: PatientsService) {}

  @GrpcMethod('PatientInternalService', 'GetPatientEligibility')
  @ServiceCallers('appointment-service', 'consultation-service', 'queue-service')
  @ServiceScopes('patient:eligibility:read')
  async getPatientEligibility(request: any) {
    let patientId = request?.patientId ?? request?.patient_id;
    const actorAccountId = request?.context?.actorAccountId ?? request?.context?.actor_account_id;
    if (!patientId && actorAccountId) {
      const p = await this.patients.getPatientByAuthAccountId(actorAccountId);
      if (p) patientId = p.id;
    }
    if (!patientId) {
      return {
        patientId: '',
        active: false,
        profileComplete: false,
        profileVersion: 0,
        callerOwnsPatient: false,
        eligibleForBooking: false,
      };
    }
    const res = await this.patients.getEligibility(
      patientId,
      actorAccountId,
    );
    return {
      patientId: res.patientId,
      active: res.active,
      profileComplete: res.profileComplete,
      profileVersion: res.profileVersion,
      callerOwnsPatient: res.callerOwnsPatient,
      eligibleForBooking: res.eligibleForBooking ?? (res.active && res.profileComplete),
    };
  }

  @GrpcMethod('PatientInternalService', 'GetPatientIdentity')
  @ServiceCallers('receptionist-service', 'medical-record-service', 'appointment-service')
  @ServiceScopes('patient:identity:read')
  async getPatientIdentity(request: { patientId: string; purpose?: string }) {
    return { patient: await this.patients.getInternalIdentity(request.patientId, request.purpose ?? 'CLINICAL') };
  }

  @GrpcMethod('PatientInternalService', 'SearchPatients')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('patient:search')
  searchPatients(request: { normalizedPhone?: string; page?: { pageSize?: number; pageToken?: string } }) {
    return this.patients.searchInternal(request.normalizedPhone, request.page?.pageSize, request.page?.pageToken);
  }
}
