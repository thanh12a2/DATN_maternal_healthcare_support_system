import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateWalkInPatientDto {
  @IsString()
  @Length(2, 150)
  fullName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @Length(7, 20)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @IsString()
  @Length(1, 250)
  reason!: string;
}
