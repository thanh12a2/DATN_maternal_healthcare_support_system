import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListReceptionCasesDto {
  @IsOptional()
  @IsIn(['OPEN', 'IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS', 'ADMITTED', 'CANCELLED', 'MANUAL_REVIEW'])
  status?: string;

  @IsOptional()
  @IsIn(['IN_PROGRESS', 'AWAITING_PAYMENT', 'FAILED_RETRYABLE', 'COMPLETED', 'CANCELLED', 'MANUAL_REVIEW'])
  admissionStatus?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
