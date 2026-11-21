import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, type PublicAuthContext } from '@platform';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ConsultationAccessGateway {
  constructor(
    private readonly config: ConfigService,
    private readonly grpc: GrpcClientFactory,
  ) {}
  async assertAppointment(appointmentId: string, patientId: string) {
    const client = this.grpc.client({
      key: 'appointment', target: this.config.get<string>('APPOINTMENT_GRPC_TARGET') ?? 'appointment-service:6008',
      proto: 'appointment/v1/appointment_internal.proto', package: 'maternal.appointment.v1', service: 'AppointmentInternalService',
    });
    let appointment: any;
    try {
      const result = await this.grpc.unary<any, any>(client, 'getAppointment', { appointmentId },
        this.grpc.metadata('appointment-service', ['appointment:internal:read']));
      appointment = result?.appointment;
    } catch (error: any) {
      if (error?.code === 5) throw new NotFoundException('APPOINTMENT_NOT_FOUND');
      throw new ServiceUnavailableException('APPOINTMENT_SERVICE_UNAVAILABLE');
    }
    if (!appointment?.appointmentId) throw new NotFoundException('APPOINTMENT_NOT_FOUND');
    if (appointment.patientId !== patientId) throw new ForbiddenException('PATIENT_MISMATCH');
    if (!['APPOINTMENT_STATUS_CHECKED_IN', 'APPOINTMENT_STATUS_IN_CLINICAL_CARE', 'APPOINTMENT_STATUS_COMPLETED'].includes(appointment.status))
      throw new ForbiddenException('APPOINTMENT_NOT_CHECKED_IN');
    return appointment;
  }
  async assertDoctorEligible(doctorId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(doctorId)))
      throw new NotFoundException('DOCTOR_NOT_FOUND');
    const client = this.grpc.client({
      key: 'doctor', target: this.config.get<string>('DOCTOR_GRPC_TARGET') ?? 'doctor-service:6005',
      proto: 'doctor/v1/doctor_internal.proto', package: 'maternal.doctor.v1', service: 'DoctorInternalService',
    });
    let doctor: any;
    try {
      const result = await this.grpc.unary<any, any>(client, 'getDoctorEligibility', { doctorId },
        this.grpc.metadata('doctor-service', ['doctor:internal:read']));
      doctor = result?.doctor;
    } catch (error: any) {
      if (error?.code === 5) throw new NotFoundException('DOCTOR_NOT_FOUND');
      throw new ServiceUnavailableException('DOCTOR_SERVICE_UNAVAILABLE');
    }
    if (!doctor?.doctorId || doctor.status !== 'DOCTOR_OPERATIONAL_STATUS_ACTIVE')
      throw new NotFoundException('DOCTOR_NOT_ACTIVE');
    return doctor;
  }
  async doctorId(auth: PublicAuthContext): Promise<string> {
    const client = this.grpc.client({
      key: 'doctor',
      target:
        this.config.get<string>('DOCTOR_GRPC_TARGET') ?? 'doctor-service:6005',
      proto: 'doctor/v1/doctor_internal.proto',
      package: 'maternal.doctor.v1',
      service: 'DoctorInternalService',
    });
    const context = {
      requestId: randomUUID(),
      correlationId: randomUUID(),
      actorAccountId: auth.userId,
      actorRole: auth.role,
    };
    try {
      const result = await this.grpc.unary<any, any>(
        client,
        'resolveDoctorByAccount',
        { context, accountId: auth.userId },
        this.grpc.metadata('doctor-service', ['doctor:internal:read'], context),
      );
      if (!result.found || !result.doctorId)
        throw new ForbiddenException('DOCTOR_PROFILE_NOT_FOUND');
      return result.doctorId;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('DOCTOR_SERVICE_UNAVAILABLE');
    }
  }
  async assertPatientOwner(
    patientId: string | undefined,
    auth: PublicAuthContext,
  ): Promise<string> {
    if (auth.role !== 'PATIENT') return patientId || '';
    const client = this.grpc.client({
      key: 'patient',
      target:
        this.config.get<string>('PATIENT_GRPC_TARGET') ??
        'patient-service:6004',
      proto: 'patient/v1/patient_internal.proto',
      package: 'maternal.patient.v1',
      service: 'PatientInternalService',
    });
    const context = {
      requestId: randomUUID(),
      correlationId: randomUUID(),
      actorAccountId: auth.userId,
      actorRole: auth.role,
    };
    try {
      const response = await this.grpc.unary<any, any>(
        client,
        'getPatientEligibility',
        { context, patientId: patientId || '' },
        this.grpc.metadata(
          'patient-service',
          ['patient:eligibility:read'],
          context,
        ),
      );
      if (!response.callerOwnsPatient)
        throw new ForbiddenException('PATIENT_OWNERSHIP_MISMATCH');
      return response.patientId;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('PATIENT_OWNERSHIP_MISMATCH');
    }
  }
}
