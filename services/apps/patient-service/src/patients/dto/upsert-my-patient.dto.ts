import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class UpsertMyPatientDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string;
  @IsString() dateOfBirth!: string;
  @IsString() phoneNumber!: string;
  @IsOptional() @IsString() nationalId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
