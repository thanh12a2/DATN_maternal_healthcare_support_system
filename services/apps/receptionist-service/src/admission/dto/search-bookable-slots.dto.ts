import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class SearchBookableSlotsDto {
  @IsUUID()
  serviceId!: string;

  @IsIn(['DOCTOR', 'RANK'])
  selectionMode!: 'DOCTOR' | 'RANK';

  @IsOptional()
  @IsUUID()
  requestedDoctorId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  requestedRankCode?: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
