import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, type PublicAuthContext } from '@platform';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ConsultationAccessGateway {
  constructor(private readonly config: ConfigService, private readonly grpc: GrpcClientFactory) {}
  async assertPatientOwner(patientId: string | undefined, auth: PublicAuthContext): Promise<string> {
    if (auth.role !== 'PATIENT') return patientId || '';
    const client = this.grpc.client({
      key: 'patient',
      target: this.config.get<string>('PATIENT_GRPC_TARGET') ?? 'patient-service:6004',
      proto: 'patient/v1/patient_internal.proto',
      package: 'maternal.patient.v1',
      service: 'PatientInternalService',
    });
    const context = { requestId: randomUUID(), correlationId: randomUUID(), actorAccountId: auth.userId, actorRole: auth.role };
    try {
      const response = await this.grpc.unary<any, any>(
        client,
        'getPatientEligibility',
        { context, patientId: patientId || '' },
        this.grpc.metadata('patient-service', ['patient:eligibility:read'], context),
      );
      if (!response.callerOwnsPatient) throw new ForbiddenException('PATIENT_OWNERSHIP_MISMATCH');
      return response.patientId;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('PATIENT_OWNERSHIP_MISMATCH');
    }
  }
}
