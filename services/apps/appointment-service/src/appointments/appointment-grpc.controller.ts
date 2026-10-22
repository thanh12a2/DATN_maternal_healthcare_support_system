import { Controller, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes, timestampToDate } from '@platform';
import { AppointmentDomainService } from './appointment.service';
import { AppointmentDomainException } from '../common/domain.exception';

@Controller()
@UseGuards(ServiceJwtGuard)
export class AppointmentGrpcController {
  constructor(private readonly service: AppointmentDomainService) {}

  @GrpcMethod('AppointmentInternalService','GetAppointment')
  @ServiceCallers('receptionist-service','billing-service','medical-record-service','queue-service')
  @ServiceScopes('appointment:internal:read')
  async getAppointment(request: any) { return { appointment: this.view(await this.service.get(request.appointmentId) as any) }; }

  @GrpcMethod('AppointmentInternalService','SearchBookableSlotsForReception')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('appointment:booking:read')
  async searchBookableSlotsForReception(request: any) {
    const result: any = await this.service.searchBookableSlotsForReception({
      serviceId: request.serviceId,
      selectionMode: request.selectionMode,
      requestedDoctorId: request.requestedDoctorId || undefined,
      requestedRankCode: request.requestedRankCode || undefined,
      from: timestampToDate(request.from),
      to: timestampToDate(request.to),
      limit: Number(request.page?.pageSize ?? 20),
    }, request.context?.actorAccountId || 'receptionist-service');
    return {
      slots: (result.items ?? []).map((slot: any) => ({
        serviceId: slot.serviceId,
        selectionMode: 'SELECTION_MODE_' + slot.selectionMode,
        doctorId: slot.doctorId ?? '',
        rankCode: slot.rankCode ?? '',
        startAt: this.time(slot.startAt),
        endAt: this.time(slot.endAt),
        availableCapacity: Number(slot.availableCapacity ?? 1),
      })),
      page: {
        nextPageToken: result.nextPageToken ?? '',
        totalSize: String(result.total ?? result.items?.length ?? 0),
      },
    };
  }

  @GrpcMethod('AppointmentInternalService','BookForReception')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('appointment:booking:write')
  async bookForReception(request: any) {
    const appointment: any = await this.rpc(() => this.service.bookForReception({
      patientId: request.patientId,
      serviceId: request.serviceId,
      selectionMode: request.selectionMode,
      requestedDoctorId: request.requestedDoctorId || undefined,
      requestedRankCode: request.requestedRankCode || undefined,
      startAt: timestampToDate(request.startAt),
      endAt: timestampToDate(request.endAt),
      channel: request.channel,
    }, request.context?.actorAccountId || 'receptionist-service', request.context?.idempotencyKey));
    return { appointment: this.view(appointment), idempotentReplay: false };
  }

  @GrpcMethod('AppointmentInternalService','SearchForReception')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('appointment:admission:read')
  async searchForReception(request: any) {
    const result: any = await this.service.searchForReception({
      patientId: request.patientId,
      appointmentCode: request.appointmentCode || undefined,
      from: timestampToDate(request.from),
      to: timestampToDate(request.to),
      limit: Number(request.page?.pageSize ?? 20),
      cursor: request.page?.pageToken || undefined,
    });
    return {
      appointments: result.items.map((item: any) => this.view(item)),
      page: {
        nextPageToken: result.nextPageToken ?? '',
        totalSize: String(result.total ?? 0),
      },
    };
  }

  @GrpcMethod('AppointmentInternalService','ValidateForAdmission')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('appointment:admission:read')
  async validateForAdmission(request: any) {
    const result: any = await this.service.validateAdmission(request.appointmentId, request.patientId);
    if (!result.valid || !result.appointment) return { valid:false, failureCode:result.failureCode ?? 'INVALID' };
    const item:any=result.appointment;
    return {valid:true,appointmentId:item.id,patientId:item.patientId,serviceId:item.serviceId,assignedDoctorId:item.assignedDoctorId,assignedRankCode:item.assignedRankCode,startAt:this.time(item.startAt),endAt:this.time(item.endAt),status:'APPOINTMENT_STATUS_'+item.status,late:Number(result.lateMinutes)>30,lateMinutes:Number(result.lateMinutes??0),appointmentVersion:String(item.version)};
  }

  @GrpcMethod('AppointmentInternalService','CheckInAppointment')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('appointment:checkin')
  async checkInAppointment(request:any) {
    const item:any=await this.service.checkIn(request.appointmentId,{...request,checkedInAt:timestampToDate(request.checkedInAt)},request.context?.idempotencyKey);
    const lateMinutes=Math.max(0,Math.floor((Date.now()-new Date(item.startAt).getTime())/60000));
    return {appointment:this.view(item),late:lateMinutes>30,lateMinutes,idempotentReplay:false};
  }

  @GrpcMethod('AppointmentInternalService','MarkClinicalStarted')
  @ServiceCallers('medical-record-service') @ServiceScopes('appointment:clinical:write')
  async markClinicalStarted(r:any){const x:any=await this.service.markClinicalStarted(r.appointmentId,{...r,startedAt:timestampToDate(r.startedAt)},r.context?.idempotencyKey);return{appointment:this.view(x),idempotentReplay:false};}

  @GrpcMethod('AppointmentInternalService','MarkClinicalCompleted')
  @ServiceCallers('medical-record-service') @ServiceScopes('appointment:clinical:write')
  async markClinicalCompleted(r:any){const x:any=await this.service.markClinicalCompleted(r.appointmentId,{...r,completedAt:timestampToDate(r.completedAt)},r.context?.idempotencyKey);return{appointment:this.view(x),idempotentReplay:false};}

  @GrpcMethod('AppointmentInternalService','MarkNoShow')
  @ServiceCallers('receptionist-service','appointment-service') @ServiceScopes('appointment:noshow')
  async markNoShow(r:any){const x:any=await this.service.markNoShow(r.appointmentId,r,r.context?.idempotencyKey);return{appointment:this.view(x),idempotentReplay:false};}

  private time(value:any){const d=new Date(value);return{seconds:Math.floor(d.getTime()/1000).toString(),nanos:(d.getTime()%1000)*1_000_000};}
  private view(x:any){return{appointmentId:x.id,appointmentCode:x.appointmentCode,patientId:x.patientId,serviceId:x.serviceId,channel:'BOOKING_CHANNEL_'+x.channel,selectionMode:'SELECTION_MODE_'+x.selectionMode,requestedDoctorId:x.requestedDoctorId??'',requestedRankCode:x.requestedRankCode??'',assignedDoctorId:x.assignedDoctorId,assignedRankCode:x.assignedRankCode,specialtyId:x.specialtyId,startAt:this.time(x.startAt),endAt:this.time(x.endAt),status:'APPOINTMENT_STATUS_'+x.status,pricing:{serviceName:x.pricing.serviceName,serviceVersion:String(x.pricing.serviceVersion),basePriceId:x.pricing.basePriceId,baseAmount:{amountMinor:String(x.pricing.baseAmountMinor),currencyCode:'VND'},rankSurchargePriceId:x.pricing.rankSurchargePriceId??'',rankSurchargeAmount:{amountMinor:String(x.pricing.rankSurchargeAmountMinor),currencyCode:'VND'},estimatedTotal:{amountMinor:String(x.pricing.estimatedTotalMinor),currencyCode:'VND'}},availabilityVersion:String(x.availabilityVersion),queueEstimateMinutes:x.queueEstimateMinutes??undefined,receptionCaseId:x.receptionCaseId??'',encounterId:x.encounterId??'',checkedInAt:x.checkedInAt?this.time(x.checkedInAt):undefined,clinicalStartedAt:x.clinicalStartedAt?this.time(x.clinicalStartedAt):undefined,completedAt:x.completedAt?this.time(x.completedAt):undefined,version:String(x.version)};}
  private async rpc<T>(work:()=>Promise<T>):Promise<T>{try{return await work();}catch(error){const status=error instanceof HttpException?error.getStatus():HttpStatus.INTERNAL_SERVER_ERROR;const code=error instanceof AppointmentDomainException?error.code:status===400?'VALIDATION_FAILED':status===403?'FORBIDDEN':status===404?'RESOURCE_NOT_FOUND':status===409?'RESOURCE_CONFLICT':status===422?'BUSINESS_RULE_VIOLATION':status===503?'DEPENDENCY_UNAVAILABLE':'INTERNAL_ERROR';const message=error instanceof Error?error.message:'Internal server error';throw new RpcException({code:this.grpcStatus(status),message:`${code}: ${message}`});}}
  private grpcStatus(status:number){if(status===400)return GrpcStatus.INVALID_ARGUMENT;if(status===401)return GrpcStatus.UNAUTHENTICATED;if(status===403)return GrpcStatus.PERMISSION_DENIED;if(status===404)return GrpcStatus.NOT_FOUND;if(status===409)return GrpcStatus.ALREADY_EXISTS;if(status===422)return GrpcStatus.FAILED_PRECONDITION;if(status===503)return GrpcStatus.UNAVAILABLE;return GrpcStatus.INTERNAL;}
}
