import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID()
  patientId!: string;

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
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsIn(['RECEPTION', 'WALK_IN'])
  channel!: 'RECEPTION' | 'WALK_IN';
}
