import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { GrpcClientFactory } from './grpc-client.factory';
import type { PublicAuthContext } from '../http/public-jwt.guard';

@Injectable()
export class ClinicalDoctorAccess {
  constructor(private readonly config: ConfigService, private readonly grpc: GrpcClientFactory) {}
  async assertEncounter(auth: PublicAuthContext, encounterId: string, patientId?: string) {
    if (!encounterId) throw new ForbiddenException('ENCOUNTER_REQUIRED');
    const context = { requestId: randomUUID(), correlationId: randomUUID(), actorAccountId: auth.userId, actorRole: auth.role };
    try {
      const doctor = this.grpc.client({ key: 'doctor', target: this.config.get<string>('DOCTOR_GRPC_TARGET') ?? 'doctor-service:6005', proto: 'doctor/v1/doctor_internal.proto', package: 'maternal.doctor.v1', service: 'DoctorInternalService' });
      const resolved = await this.grpc.unary<any, any>(doctor, 'resolveDoctorByAccount', { context, accountId: auth.userId }, this.grpc.metadata('doctor-service', ['doctor:internal:read'], context));
      if (!resolved.found || !resolved.doctorId) throw new ForbiddenException('DOCTOR_PROFILE_NOT_FOUND');
      const medical = this.grpc.client({ key: 'medical', target: this.config.get<string>('MEDICAL_RECORD_GRPC_TARGET') ?? 'medical-record-service:6011', proto: 'medical_record/v1/medical_record_internal.proto', package: 'maternal.medical_record.v1', service: 'MedicalRecordInternalService' });
      const result = await this.grpc.unary<any, any>(medical, 'validateEncounterAccess', { context, encounterId, doctorId: resolved.doctorId }, this.grpc.metadata('medical-record-service', ['medical:access:validate'], context));
      if (!result.allowed || (patientId && result.encounter?.patientId !== patientId)) throw new ForbiddenException('NOT_ASSIGNED');
      return { ...result.encounter, resolvedDoctorId: resolved.doctorId };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('CLINICAL_DEPENDENCY_UNAVAILABLE');
    }
  }
}
