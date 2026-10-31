import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, dateToTimestamp } from '@platform';

@Injectable()
export class DoctorIdentityGateway {
  constructor(private readonly config: ConfigService, private readonly grpc: GrpcClientFactory) {}

  async resolve(accountId: string): Promise<string> {
    try {
      const client = this.grpc.client({ key: 'doctor', target: this.config.get<string>('DOCTOR_GRPC_TARGET') ?? 'doctor-service:6005', proto: 'doctor/v1/doctor_internal.proto', package: 'maternal.doctor.v1', service: 'DoctorInternalService' });
      const result = await this.grpc.unary<any, any>(client, 'resolveDoctorByAccount', { accountId }, this.grpc.metadata('doctor-service', ['doctor:internal:read']));
      if (!result.found || !result.doctorId) throw new ForbiddenException('DOCTOR_PROFILE_NOT_FOUND');
      return result.doctorId;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('DOCTOR_SERVICE_UNAVAILABLE');
    }
  }

  async checkedIn(appointmentId: string, encounterId: string, doctorId: string): Promise<boolean> {
    try {
      const client = this.grpc.client({ key: 'appointment', target: this.config.get<string>('APPOINTMENT_GRPC_TARGET') ?? 'appointment-service:6008', proto: 'appointment/v1/appointment_internal.proto', package: 'maternal.appointment.v1', service: 'AppointmentInternalService' });
      const result = await this.grpc.unary<any, any>(client, 'getAppointment', { appointmentId }, this.grpc.metadata('appointment-service', ['appointment:internal:read']));
      const appointment = result.appointment;
      return appointment?.encounterId === encounterId && appointment.assignedDoctorId === doctorId && ['APPOINTMENT_STATUS_CHECKED_IN', 'APPOINTMENT_STATUS_IN_CLINICAL_CARE'].includes(appointment.status);
    } catch {
      throw new ServiceUnavailableException('APPOINTMENT_SERVICE_UNAVAILABLE');
    }
  }

  async reconcileAppointment(job: { id: string; appointmentId: string; encounterId: string; encounterVersion: number; action: string; createdAt: Date }) {
    const client = this.grpc.client({ key: 'appointment', target: this.config.get<string>('APPOINTMENT_GRPC_TARGET') ?? 'appointment-service:6008', proto: 'appointment/v1/appointment_internal.proto', package: 'maternal.appointment.v1', service: 'AppointmentInternalService' });
    const context = { requestId: job.id, correlationId: job.id, idempotencyKey: `medical-sync:${job.id}` };
    const result = await this.grpc.unary<any, any>(client, 'getAppointment', { context, appointmentId: job.appointmentId }, this.grpc.metadata('appointment-service', ['appointment:internal:read'], context));
    const appointment = result.appointment;
    if (!appointment || appointment.encounterId !== job.encounterId) throw new Error('APPOINTMENT_ENCOUNTER_MISMATCH');
    const started = 'APPOINTMENT_STATUS_IN_CLINICAL_CARE', completed = 'APPOINTMENT_STATUS_COMPLETED';
    if ((job.action === 'START' && [started, completed].includes(appointment.status)) || (job.action === 'COMPLETE' && appointment.status === completed)) return;
    if (!['START', 'COMPLETE'].includes(job.action) || (job.action === 'START' && appointment.status !== 'APPOINTMENT_STATUS_CHECKED_IN') || (job.action === 'COMPLETE' && !['APPOINTMENT_STATUS_CHECKED_IN', started].includes(appointment.status))) throw new Error('APPOINTMENT_STATE_CONFLICT');
    const timeField = job.action === 'START' ? { startedAt: dateToTimestamp(job.createdAt) } : { completedAt: dateToTimestamp(job.createdAt) };
    await this.grpc.unary(client, job.action === 'START' ? 'markClinicalStarted' : 'markClinicalCompleted', { context, appointmentId: job.appointmentId, encounterId: job.encounterId, medicalRecordVersion: String(job.encounterVersion), expectedVersion: appointment.version, ...timeField }, this.grpc.metadata('appointment-service', ['appointment:clinical:write'], context));
  }
}
