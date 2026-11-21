import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClinicalDoctorAccess,
  GrpcClientFactory,
  type PublicAuthContext,
} from '@platform';
import { randomUUID } from 'node:crypto';

@Injectable()
export class BillingAccessService {
  constructor(
    private readonly config: ConfigService,
    private readonly grpc: GrpcClientFactory,
    private readonly clinical: ClinicalDoctorAccess,
  ) {}

  async patientId(auth: PublicAuthContext): Promise<string> {
    const context = {
      requestId: randomUUID(),
      correlationId: randomUUID(),
      actorAccountId: auth.userId,
      actorRole: auth.role,
    };
    try {
      const client = this.grpc.client({
        key: 'billing-patient',
        target:
          this.config.get<string>('PATIENT_GRPC_TARGET') ??
          'patient-service:6004',
        proto: 'patient/v1/patient_internal.proto',
        package: 'maternal.patient.v1',
        service: 'PatientInternalService',
      });
      const result = await this.grpc.unary<any, any>(
        client,
        'getPatientEligibility',
        { context },
        this.grpc.metadata(
          'patient-service',
          ['patient:eligibility:read'],
          context,
        ),
      );
      if (!result.patientId || !result.callerOwnsPatient)
        throw new ForbiddenException('PATIENT_NOT_FOUND');
      return result.patientId;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('BILLING_ACCESS_UNAVAILABLE');
    }
  }

  async assertDoctorInvoice(
    auth: PublicAuthContext,
    invoice: {
      encounterId?: string | null;
      appointmentId?: string | null;
      patientId: string;
    },
  ) {
    let encounterId = invoice.encounterId;
    if (!encounterId && invoice.appointmentId) {
      try {
        const client = this.grpc.client({
          key: 'billing-appointment',
          target:
            this.config.get<string>('APPOINTMENT_GRPC_TARGET') ??
            'appointment-service:6008',
          proto: 'appointment/v1/appointment_internal.proto',
          package: 'maternal.appointment.v1',
          service: 'AppointmentInternalService',
        });
        const result = await this.grpc.unary<any, any>(
          client,
          'getAppointment',
          { appointmentId: invoice.appointmentId },
          this.grpc.metadata('appointment-service', [
            'appointment:internal:read',
          ]),
        );
        encounterId = result.appointment?.encounterId;
      } catch {
        throw new ServiceUnavailableException('BILLING_ACCESS_UNAVAILABLE');
      }
    }
    if (!encounterId) throw new ForbiddenException('ENCOUNTER_REQUIRED');
    const encounter = await this.clinical.assertEncounter(
      auth,
      encounterId,
      invoice.patientId,
    );
    if (
      invoice.appointmentId &&
      encounter.appointmentId !== invoice.appointmentId
    )
      throw new ForbiddenException('APPOINTMENT_MISMATCH');
  }
}
