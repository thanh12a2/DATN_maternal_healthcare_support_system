import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes, dateToTimestamp, timestampToDate } from '@platform';
import { DoctorDomainService } from '../doctors/doctor.service';

@Controller()
@UseGuards(ServiceJwtGuard)
@ServiceScopes('doctor:internal:read')
export class DoctorGrpcController {
  constructor(private readonly doctors: DoctorDomainService) {}

  @GrpcMethod('DoctorInternalService', 'ResolveDoctorByAccount')
  @ServiceCallers('appointment-service', 'medical-record-service', 'consultation-service', 'prescription-service', 'treatment-plan-service')
  async resolveDoctorByAccount(request: { accountId: string }) {
    const doctorId = await this.doctors.findDoctorIdByAccount(request.accountId);
    return { doctorId: doctorId ?? '', found: Boolean(doctorId) };
  }

  @GrpcMethod('DoctorInternalService', 'GetDoctorEligibility')
  @ServiceCallers('appointment-service', 'medical-record-service')
  async getDoctorEligibility(request: { doctorId: string; requiredSpecialtyId?: string; at?: any }) {
    return { doctor: await this.doctors.getInternalEligibility(request.doctorId, request.requiredSpecialtyId) };
  }

  @GrpcMethod('DoctorInternalService', 'ListEligibleDoctors')
  @ServiceCallers('appointment-service', 'medical-record-service')
  async listEligibleDoctors(request: { specialtyId: string; consultationRankCode?: string; intervalStart?: any; intervalEnd?: any; page?: { pageSize?: number } }) {
    const start = timestampToDate(request.intervalStart);
    const end = timestampToDate(request.intervalEnd);
    const result = await this.doctors.listInternalEligibleDoctors(request.specialtyId, request.consultationRankCode, start, end, request.page?.pageSize ?? 20);
    return { doctors: result, page: { nextPageToken: '', totalSize: String(result.length) } };
  }

  @GrpcMethod('DoctorInternalService', 'GetDoctorAvailability')
  @ServiceCallers('appointment-service', 'medical-record-service')
  async getDoctorAvailability(request: { doctorId: string; rangeStart: any; rangeEnd: any }) {
    const start = timestampToDate(request.rangeStart);
    const end = timestampToDate(request.rangeEnd);
    if (!start || !end) return { doctorId: request.doctorId, availableIntervals: [], availabilityVersion: '0' };
    const value = await this.doctors.getInternalAvailability(request.doctorId, start, end);
    return {
      doctorId: request.doctorId,
      availableIntervals: value.intervals.map((x: any) => ({
        startAt: dateToTimestamp(x.startAt),
        endAt: dateToTimestamp(x.endAt),
        roomId: x.roomId ?? '',
        roomCode: x.roomCode ?? '',
        roomName: x.roomName ?? '',
        slotDurationMinutes: x.slotDurationMinutes ?? 30,
      })),
      availabilityVersion: String(value.version),
    };
  }
}
