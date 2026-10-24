import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class OpenReceptionCaseDto {
  @IsUUID()
  appointmentId!: string;

  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsDateString()
  arrivalAt?: string;
}
