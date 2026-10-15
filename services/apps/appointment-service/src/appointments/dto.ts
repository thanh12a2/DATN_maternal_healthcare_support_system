import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { BookingChannel, SelectionMode } from '../../../../generated/appointment-client';
export class SlotQueryDto { @IsUUID() serviceId!:string; @IsEnum(SelectionMode) selectionMode!:SelectionMode; @IsOptional() @IsUUID() doctorId?:string; @IsOptional() @IsUUID() requestedDoctorId?:string; @IsOptional() @IsString() @Length(1,50) rankCode?:string; @IsOptional() @IsString() @Length(1,50) requestedRankCode?:string; @IsDateString() from!:string; @IsDateString() to!:string; @IsOptional() @IsInt() @Min(1) @Max(100) @Type(()=>Number) limit?:number; }
export class CreateHoldDto { @IsOptional() @IsUUID() patientId?:string; @IsUUID() serviceId!:string; @IsEnum(SelectionMode) selectionMode!:SelectionMode; @IsOptional() @IsUUID() requestedDoctorId?:string; @IsOptional() @IsString() @Length(1,50) requestedRankCode?:string; @IsDateString() startAt!:string; @IsDateString() endAt!:string; }
export class CreateAppointmentDto { @IsUUID() holdId!:string; @IsEnum(BookingChannel) channel!:BookingChannel; }
export class ReasonVersionDto { @IsString() @Length(3,500) reason!:string; @IsOptional() @IsString() @Length(1,50) reasonCode?:string; @IsInt() @Min(1) expectedVersion!:number; }
export class RescheduleDto extends ReasonVersionDto { @IsUUID() newHoldId!:string; }
export class ReassignDto extends ReasonVersionDto { @IsUUID() doctorId!:string; @IsString() @Length(1,500) confirmationEvidence!:string; }
export class AppointmentListDto { @IsOptional() @IsUUID() patientId?:string; @IsOptional() @IsString() status?:string; @IsOptional() @IsDateString() from?:string; @IsOptional() @IsDateString() to?:string; @IsOptional() @IsInt() @Min(1) @Max(100) @Type(()=>Number) limit?:number; @IsOptional() @IsString() cursor?:string; }
