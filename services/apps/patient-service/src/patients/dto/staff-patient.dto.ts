import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePatientDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string;
  @IsString() dateOfBirth!: string;
  @IsString() phoneNumber!: string;
  @IsOptional() @IsString() nationalId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsString() @MinLength(1) @MaxLength(250) reason!: string;
}

export class PatchPatientDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() nationalId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(1) @MaxLength(250) reason!: string;
}

export class SearchPatientsDto {
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() nationalId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @IsOptional() @IsInt() @Min(1) page = 1;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit = 20;
}
