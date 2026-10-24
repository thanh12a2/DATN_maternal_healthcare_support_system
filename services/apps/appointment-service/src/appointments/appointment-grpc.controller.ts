import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes, timestampToDate } from '@platform';
import { AppointmentDomainService } from './appointment.service';

@Controller()
@UseGuards(ServiceJwtGuard)
export class AppointmentGrpcController {
  constructor(private readonly service: AppointmentDomainService) {}

  @GrpcMethod('AppointmentInternalService','GetAppointment')
  @ServiceCallers('receptionist-service','billing-service','medical-record-service','queue-service')
  @ServiceScopes('appointment:internal:read')
  async getAppointment(request: any) { return { appointment: this.view(await this.service.get(request.appointmentId) as any) }; }

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
}
