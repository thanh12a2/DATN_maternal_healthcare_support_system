import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory } from '@platform';

@Injectable()
export class PatientDependencyGateway {
  constructor(
    private readonly config: ConfigService,
    private readonly grpc: GrpcClientFactory,
  ) {}

  async resolvePatientId(accountId: string): Promise<string> {
    const client = this.grpc.client({
      key: 'patient',
      target: this.config.get<string>('PATIENT_GRPC_TARGET') ?? 'patient-service:6004',
      proto: 'patient/v1/patient_internal.proto',
      package: 'maternal.patient.v1',
      service: 'PatientInternalService',
    });
    const context = {
      requestId: `queue-patient-${accountId}`,
      correlationId: `queue-patient-${accountId}`,
      actorAccountId: accountId,
      actorRole: 'PATIENT',
    };
    const response = await this.grpc.unary<any, { patientId?: string }>(
      client,
      'getPatientEligibility',
      { context },
      this.grpc.metadata('patient-service', ['patient:eligibility:read'], context),
    );
    if (!response?.patientId) {
      throw new NotFoundException('PATIENT_PROFILE_NOT_FOUND');
    }
    return response.patientId;
  }
}
