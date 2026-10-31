import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum ReceptionistGenderDto {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
  OTHER = 'OTHER',
}

export class UpdateReceptionistProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsEmail()
  @MaxLength(255)
  loginEmail?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20)
  @Matches(/^[+0-9][0-9 .()-]{7,19}$/)
  workPhone?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(100)
  department?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(ReceptionistGenderDto)
  gender?: ReceptionistGenderDto | null;
}

export class UpdateReceptionistDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{1,29}$/)
  employeeCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateReceptionistProfileDto)
  profile?: UpdateReceptionistProfileDto;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(250)
  reason!: string;
}
