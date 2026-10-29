import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory } from '@platform';

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
}
