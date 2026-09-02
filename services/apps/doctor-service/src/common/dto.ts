import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AvailabilityReasonCode,
  AvailabilityType,
  DoctorStatus,
  ScheduleStatus,
  SpecialtyStatus,
} from '../../../../generated/doctor-client';

export class ProfileDto {
  @IsString() @Length(2, 150) fullName!: string;
  @IsOptional() @IsString() @MaxLength(100) professionalTitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) biography?: string;
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear())
  practiceStartYear?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(2, 10, { each: true })
  languages?: string[];
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  photoUrl?: string;
}
export class CreateDoctorDto {
  @IsUUID() accountId!: string;
  @IsString() @Length(3, 50) licenseNumber!: string;
  @ValidateNested() @Type(() => ProfileDto) profile!: ProfileDto;
}
export class UpdateDoctorDto {
  @IsOptional() @IsString() @Length(2, 150) fullName?: string;
  @IsOptional() @IsString() @MaxLength(100) professionalTitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) biography?: string;
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear())
  practiceStartYear?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(2, 10, { each: true })
  languages?: string[];
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  photoUrl?: string;
  @IsOptional() @IsString() @Length(3, 50) licenseNumber?: string;
}
export class CreateSpecialtyDto {
  @IsString() @Length(2, 50) code!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class SpecialtyLinkDto {
  @IsBoolean() isPrimary!: boolean;
}
export class CreateScheduleDto {
  @IsInt() @Min(1) @Max(7) dayOfWeek!: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional()
  @IsInt()
  @IsEnum([15, 20, 30, 45, 60])
  slotDurationMinutes?: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() roomId?: string;
}
export class UpdateScheduleDto {
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsInt() slotDurationMinutes?: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() roomId?: string;
}
export class ReasonDto {
  @IsString() @Length(3, 500) reason!: string;
}
export class CreateAvailabilityDto {
  @IsEnum(AvailabilityType) type!: AvailabilityType;
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
  @IsEnum(AvailabilityReasonCode) reasonCode!: AvailabilityReasonCode;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class AvailabilityQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
  @IsOptional() @IsInt() slotDurationMinutes?: number;
}
export class ListQueryDto {
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsEnum(DoctorStatus) status?: DoctorStatus;
  @IsOptional() @IsString() @Length(2, 100) q?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
  @IsOptional() cursor?: string;
}
export class SpecialtyListQueryDto {
  @IsOptional() @IsEnum(SpecialtyStatus) status?: SpecialtyStatus;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
  @IsOptional() cursor?: string;
}
export class ScheduleListQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(ScheduleStatus) status?: ScheduleStatus;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
}
