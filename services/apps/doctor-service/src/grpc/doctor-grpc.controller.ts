import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes, dateToTimestamp, timestampToDate } from '@platform';
import { DoctorDomainService } from '../doctors/doctor.service';

@Controller()
@UseGuards(ServiceJwtGuard)
@ServiceCallers('appointment-service', 'medical-record-service')
@ServiceScopes('doctor:internal:read')
export class DoctorGrpcController {
  constructor(private readonly doctors: DoctorDomainService) {}

  @GrpcMethod('DoctorInternalService', 'GetDoctorEligibility')
  async getDoctorEligibility(request: { doctorId: string; requiredSpecialtyId?: string; at?: any }) {
    return { doctor: await this.doctors.getInternalEligibility(request.doctorId, request.requiredSpecialtyId) };
  }

  @GrpcMethod('DoctorInternalService', 'ListEligibleDoctors')
  async listEligibleDoctors(request: { specialtyId: string; consultationRankCode?: string; intervalStart?: any; intervalEnd?: any; page?: { pageSize?: number } }) {
    const start = timestampToDate(request.intervalStart);
    const end = timestampToDate(request.intervalEnd);
    const result = await this.doctors.listInternalEligibleDoctors(request.specialtyId, request.consultationRankCode, start, end, request.page?.pageSize ?? 20);
    return { doctors: result, page: { nextPageToken: '', totalSize: String(result.length) } };
  }

  @GrpcMethod('DoctorInternalService', 'GetDoctorAvailability')
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
